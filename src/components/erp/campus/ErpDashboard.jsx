import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, Stat, Table, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, rpc } from '../../../lib/erp/rpc';
import { CRM_STAGES, labelOf } from '../../../lib/erp/campusApi';
import { sendFeeReminder, shortMonth } from '../../../lib/erp/opsApi';
import { runAction } from '../../../lib/erp/financeApi';
import { openChatConversation } from '../../../lib/chatApi';
import { usePortalNav } from '../../../context/PortalNavContext';

const BAR = '#11694A';
const GOLD = '#C29A3A';
const RED = '#B91C1C';
const BLUE = '#0F7C86';
const GRID = '#E8E1D0';
const AXIS = '#4A5E56';

function Tile({ label, value, hint, tone, icon, module, go }) {
  const inner = <Stat label={label} value={value} hint={hint} tone={tone} icon={icon} className="w-full" />;
  if (!module) return <div className="h-full">{inner}</div>;
  return (
    <button
      type="button"
      onClick={() => go(module)}
      className="h-full w-full flex flex-col text-start rounded-2xl hover:ring-2 hover:ring-emerald-600/50 transition"
    >
      {inner}
    </button>
  );
}

function ChartTooltip({ active, payload, label, money, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-paper-white border border-sand-border px-3 py-2 text-xs text-ink-text-primary shadow-manuscript-sm space-y-0.5">
      <div className="text-ink-text-muted font-medium">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="font-bold flex items-center gap-1.5" style={{ color: entry.color || '#0B3B2E' }}>
          <span>{entry.name}:</span>
          <span>{money ? formatMoney(entry.value) : `${entry.value}${suffix}`}</span>
        </div>
      ))}
    </div>
  );
}

export default function ErpDashboard() {
  const { t, ar } = useLang();
  const auth = useAuth();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const portalNav = usePortalNav();
  const [state, reload] = useAsync(async () => {
    const [stats, mess] = await Promise.all([
      rpc('org_dashboard_stats'),
      auth.isStoreStaff ? rpc('mess_inventory_summary').catch(() => null) : Promise.resolve(null),
    ]);
    return { ...(stats ?? {}), mess };
  }, [auth.isStoreStaff]);
  const [messagingId, setMessagingId] = useState(null);

  const canStudents = Boolean(auth.isAdmin || auth.isAcademicAdmin || auth.isAdmissionsStaff || auth.isTutor || auth.isHostelStaff || auth.isWelfareStaff);
  const canHr = Boolean(auth.isHrStaff || auth.isPrincipal || auth.isVP);
  const canAcademics = Boolean(auth.isAdmin || auth.isAcademicAdmin || auth.isTutor);
  const canFinance = Boolean(auth.isFinanceViewer);
  const canCrm = Boolean(auth.isAdmissionsStaff);
  const canWelfare = Boolean(auth.isWelfareStaff);
  const canHostel = Boolean(auth.isHostelStaff);
  const canCertificates = Boolean(auth.isAcademicAdmin || auth.isAdmin);
  const canPayroll = Boolean(auth.isHrStaff || auth.isFinanceViewer);
  const canExpenses = Boolean(auth.isFinanceViewer || auth.isFinanceStaff);
  const canStore = Boolean(auth.isStoreStaff);
  const canRemind = Boolean(auth.isFinanceStaff || auth.isAdmin || auth.isPrincipal);
  const showPeople = canStudents || canHr || canAcademics;
  const showCampus = canCrm || canWelfare || canHostel || canCertificates;

  const go = (module) => {
    if (portalNav?.goErpModule?.(module)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (window.location.pathname.startsWith('/erp')) {
      setParams({ module });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(`/erp?module=${encodeURIComponent(module)}`);
  };

  const remindStudent = async (row) => {
    const res = await runAction(() => sendFeeReminder(row.student_id));
    if (res?.ok) toast.success(`${t('Fee reminder sent', 'أُرسل تذكير الرسوم')}: ${row.full_name || ''}`);
    else if (res) toast.info(t('No overdue balance found for this student.', 'لا توجد متأخرات مستحقة على هذا الطالب.'));
  };

  const messageGuardian = async (row) => {
    if (!row.guardian_id) {
      toast.info(t('No linked guardian portal account — sending fee reminder instead.', 'لا يوجد حساب ولي أمر مرتبط — جارٍ إرسال تذكير الرسوم.'));
      await remindStudent(row);
      return;
    }
    setMessagingId(row.student_id);
    try {
      const convId = await openChatConversation(row.guardian_id);
      if (portalNav?.goTab) {
        setParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', 'messages');
          next.set('conversation', convId);
          return next;
        });
      } else {
        navigate(`/messages?conversation=${encodeURIComponent(convId)}`);
      }
    } catch (e) {
      toast.error(e.message || t('Could not open guardian chat', 'تعذر فتح محادثة ولي الأمر'));
    } finally {
      setMessagingId(null);
    }
  };

  const acctTypeLabel = (type) => ({
    asset: t('Assets', 'الأصول'),
    liability: t('Liabilities', 'الالتزامات'),
    equity: t('Equity', 'حقوق الملكية'),
    income: t('Income', 'الإيرادات'),
    expense: t('Expenses', 'المصروفات'),
  })[type] || type;

  return (
    <div>
      <PageHeader
        title={t('Institution overview', 'نظرة عامة على المؤسسة')}
        subtitle={t('Live KPIs, trends, cheques, chart of accounts, HR & guardian arrears.', 'مؤشرات مباشرة، اتجاهات، الشيكات، دليل الحسابات، الموارد البشرية ومتأخرات أولياء الأمور.')}
        actions={<Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>}
      />
      <AsyncView state={state}>
        {(s) => {
          const att = s.attendance_today || {};
          const fees = s.fees_month || {};
          const hostel = s.hostel || {};
          const pay = s.last_payroll;
          const cheques = s.cheques || {};
          const accounts = s.accounts_summary || [];
          const financeTrend = (s.finance_trend || []).map((r) => ({ ...r, label: shortMonth(r.month) }));
          const attendanceTrend = s.attendance_trend || [];
          const arrears = s.top_arrears || [];
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
              {showPeople && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('People', 'الأشخاص')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                    {canStudents && (
                      <Tile go={go} module="students" icon="school" label={t('Students', 'الطلاب')} value={s.students ?? 0} hint={t('Approved students', 'الطلاب المعتمدون')} />
                    )}
                    {canHr && (
                      <Tile go={go} module="hr" icon="badge" label={t('Employees', 'الموظفون')} value={s.employees ?? 0} hint={t('Active staff & tutors', 'الموظفون والمعلمون')} tone="blue" />
                    )}
                    {canStudents && (
                      <Tile go={go} module="students" icon="groups" label={t('Parents', 'أولياء الأمور')} value={s.parents ?? 0} hint={t('Linked guardians', 'أولياء الأمور المسجلون')} tone="gray" />
                    )}
                    {canStudents && (
                      <Tile
                        go={go}
                        module="students"
                        icon="pending_actions"
                        label={t('Pending approvals', 'بانتظار الموافقة')}
                        value={s.pending_approvals ?? 0}
                        hint={`${s.pending_parent_links ?? 0} ${t('parent link requests', 'طلبات ربط')}`}
                        tone={s.pending_approvals ? 'amber' : 'gray'}
                      />
                    )}
                    {canAcademics && (
                      <Tile
                        go={go}
                        module="academics"
                        icon="event_available"
                        label={t('Attendance today', 'حضور اليوم')}
                        value={att.rate != null ? `${att.rate}%` : '—'}
                        hint={`${att.present ?? 0}/${att.marked ?? 0} ${t('marked', 'مسجل')}`}
                      />
                    )}
                    {canHr && (
                      <Tile
                        go={go}
                        module="hr"
                        icon="event_busy"
                        label={t('Leave pending', 'إجازات معلقة')}
                        value={(s.staff_leave_pending ?? 0) + (s.student_leave_pending ?? 0)}
                        hint={`${t('Staff', 'موظفون')} ${s.staff_leave_pending ?? 0} · ${t('Students', 'طلاب')} ${s.student_leave_pending ?? 0}`}
                        tone="amber"
                      />
                    )}
                  </div>
                </section>
              )}

              {canFinance && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('Finance', 'المالية')} · {fees.month}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                    <Tile go={go} module="fees" icon="receipt_long" label={t('Fees invoiced', 'الرسوم المفوترة')} value={formatMoney(fees.invoiced)} hint={t('Current month', 'الشهر الحالي')} tone="gray" />
                    <Tile go={go} module="fees" icon="payments" label={t('Fees collected', 'الرسوم المحصلة')} value={formatMoney(fees.collected)} hint={t('Current month', 'الشهر الحالي')} />
                    <Tile
                      go={go}
                      module="fees"
                      icon="warning"
                      label={t('Outstanding (month)', 'المتبقي (الشهر)')}
                      value={formatMoney(fees.outstanding)}
                      hint={`${t('All time', 'الإجمالي')}: ${formatMoney(s.fees_outstanding_total)}`}
                      tone="red"
                    />
                    <Tile go={go} module="fees" icon="trending_up" label={t('Collections 30 days', 'تحصيل 30 يومًا')} value={formatMoney(s.collections_30d)} hint={t('Posted receipts', 'إيصالات مرحلة')} />
                    <Tile
                      go={go}
                      module={canExpenses ? 'expenses' : undefined}
                      icon="money_off"
                      label={t('Expenses (month)', 'المصروفات (الشهر)')}
                      value={formatMoney(s.expenses_month)}
                      hint={`${s.expenses_pending ?? 0} ${t('awaiting approval', 'بانتظار الموافقة')}`}
                      tone="amber"
                    />
                    <Tile go={go} module="donations" icon="volunteer_activism" label={t('Donations (month)', 'التبرعات (الشهر)')} value={formatMoney(s.donations_month)} hint={t('Recorded this month', 'المسجلة هذا الشهر')} tone="blue" />
                    <Tile
                      go={go}
                      module={canPayroll ? 'payroll' : undefined}
                      icon="badge"
                      label={t('Last payroll', 'آخر رواتب')}
                      value={pay ? formatMoney(pay.net) : '—'}
                      hint={pay ? `${pay.period} · ${pay.status} · ${pay.staff} ${t('staff', 'موظف')}` : t('No payroll yet', 'لا رواتب بعد')}
                      tone="gray"
                    />
                    <Tile
                      go={go}
                      module="accounting"
                      icon="account_balance"
                      label={t('Net Cashflow (month)', 'صافي التدفق (الشهر)')}
                      value={formatMoney(Number(fees.collected || 0) + Number(s.donations_month || 0) - Number(s.expenses_month || 0))}
                      hint={t('Collected + Donations − Expenses', 'المحصل + التبرعات − المصروفات')}
                      tone={Number(fees.collected || 0) + Number(s.donations_month || 0) - Number(s.expenses_month || 0) >= 0 ? 'emerald' : 'red'}
                    />
                  </div>
                </section>
              )}

              {canFinance && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('Cheques register overview', 'نظرة عامة على الشيكات')}</h3>
                    <Button size="sm" variant="ghost" onClick={() => go('cheques')}>{t('Open Cheques', 'فتح الشيكات')} →</Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                    <Tile go={go} module="cheques" icon="request_quote" label={t('Cheques in hand', 'شيكات بالحوزة')} value={formatMoney(cheques.in_hand)} hint={`${cheques.in_hand_count ?? 0} ${t('pending', 'معلقة')}`} tone="amber" />
                    <Tile go={go} module="cheques" icon="event_busy" label={t('Due today / overdue', 'مستحقة اليوم / متأخرة')} value={formatMoney(cheques.due_today)} hint={`${cheques.due_today_count ?? 0} ${t('cheques due', 'شيك مستحق')}`} tone={Number(cheques.due_today) > 0 ? 'red' : 'gray'} />
                    <Tile go={go} module="cheques" icon="account_balance" label={t('Deposited / cleared', 'مودعة / مصروفة')} value={formatMoney(Number(cheques.deposited || 0) + Number(cheques.cleared_month || 0))} hint={`${t('Cleared', 'مصروف')}: ${formatMoney(cheques.cleared_month)}`} tone="blue" />
                    <Tile go={go} module="cheques" icon="cancel" label={t('Bounced cheques', 'شيكات مرتجعة')} value={formatMoney(cheques.bounced)} hint={`${cheques.bounced_count ?? 0} ${t('bounced', 'مرتجع')}`} tone={Number(cheques.bounced) > 0 ? 'red' : 'emerald'} />
                  </div>
                </section>
              )}

              {showCampus && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('Campus & admissions', 'الحرم والقبول')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                    {canCrm && <Tile go={go} module="crm" icon="explore" label={t('Overdue follow-ups', 'متابعات متأخرة')} value={s.followups_overdue ?? 0} hint={t('CRM leads', 'متابعات القبول')} tone={s.followups_overdue ? 'red' : 'gray'} />}
                    {canWelfare && <Tile go={go} module="welfare" icon="health_and_safety" label={t('Open discipline cases', 'حالات انضباط مفتوحة')} value={s.discipline_open ?? 0} hint={t('Student welfare', 'رعاية الطلاب')} tone="amber" />}
                    {canHostel && (
                      <Tile
                        go={go}
                        module="hostel"
                        icon="apartment"
                        label={t('Hostel occupancy', 'إشغال السكن')}
                        value={occRate != null ? `${occRate}%` : '—'}
                        hint={`${hostel.occupied ?? 0}/${hostel.beds ?? 0} ${t('beds', 'سرير')}`}
                        tone="blue"
                      />
                    )}
                    {canCertificates && <Tile go={go} module="certificates" icon="workspace_premium" label={t('Document requests', 'طلبات الوثائق')} value={s.document_requests_pending ?? 0} hint={t('Pending review', 'بانتظار المراجعة')} tone="amber" />}
                    {canStore && (
                      <Tile
                        go={go}
                        module="inventory"
                        icon="inventory_2"
                        label={t('Store Low Stock', 'نواقص المخزن')}
                        value={s.mess?.low_stock_count ?? 0}
                        hint={`${s.mess?.total_items ?? 0} ${t('store items', 'صنف')}`}
                        tone={s.mess?.low_stock_count ? 'red' : 'emerald'}
                      />
                    )}
                  </div>
                </section>
              )}

              {(canFinance || canAcademics) && (
                <div className={`grid grid-cols-1 ${canFinance && canAcademics ? 'xl:grid-cols-2' : ''} gap-6`}>
                  {canFinance && (
                    <Card title={t('6-Month Financial Trend (Line Chart)', 'الاتجاه المالي لـ 6 أشهر (رسم خطي)')} actions={<Button size="sm" variant="ghost" onClick={() => go('analytics')}>{t('Full analytics', 'التحليلات الكاملة')} →</Button>}>
                      {financeTrend.length ? (
                        <div className="h-64" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={financeTrend} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                              <CartesianGrid stroke={GRID} vertical={false} />
                              <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toLocaleString('en-LK')} />
                              <Tooltip content={<ChartTooltip money />} />
                              <Line type="monotone" dataKey="invoiced" name={t('Invoiced', 'المفوتر')} stroke={GOLD} strokeWidth={2.5} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="collected" name={t('Collected', 'المحصل')} stroke={BAR} strokeWidth={2.5} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="expenses" name={t('Expenses', 'المصروفات')} stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyState text={t('No monthly financial history yet.', 'لا توجد بيانات مالية شهرية بعد.')} />
                      )}
                    </Card>
                  )}

                  {canAcademics && (
                    <Card title={t('Attendance Rate Trend (Line Chart)', 'اتجاه نسبة الحضور (رسم خطي)')} actions={<Button size="sm" variant="ghost" onClick={() => go('academics')}>{t('Open Academics', 'فتح الأكاديميات')} →</Button>}>
                      {attendanceTrend.length ? (
                        <div className="h-64" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={attendanceTrend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                              <CartesianGrid stroke={GRID} vertical={false} />
                              <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis domain={[0, 100]} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                              <Tooltip content={<ChartTooltip suffix="%" />} />
                              <Line type="monotone" dataKey="rate" name={t('Attendance %', 'نسبة الحضور %')} stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyState text={t('No attendance records yet.', 'لا توجد سجلات حضور بعد.')} />
                      )}
                    </Card>
                  )}
                </div>
              )}

              {(canCrm || canFinance) && (
                <div className={`grid grid-cols-1 ${canCrm && canFinance ? 'xl:grid-cols-2' : ''} gap-6`}>
                  {canCrm && (
                    <Card title={t('Admissions pipeline', 'مسار القبول')} actions={<Button size="sm" variant="ghost" onClick={() => go('crm')}>{t('Open CRM', 'فتح CRM')} →</Button>}>
                      <div className="h-64" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pipeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(17,105,74,0.06)' }} content={<ChartTooltip />} />
                            <Bar dataKey="value" name={t('Applications', 'الطلبات')} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}
                  {canFinance && (
                    <Card title={`${t('Fees this month', 'رسوم هذا الشهر')} (${fees.month || ''})`} actions={<Button size="sm" variant="ghost" onClick={() => go('fees')}>{t('Open fees', 'فتح الرسوم')} →</Button>}>
                      <div className="h-64" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={feeBars} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toLocaleString('en-LK')} />
                            <Tooltip cursor={{ fill: 'rgba(17,105,74,0.06)' }} content={<ChartTooltip money />} />
                            <Bar dataKey="value" name={t('Amount', 'المبلغ')} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={56} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {(canFinance || canHr) && (
                <div className={`grid grid-cols-1 ${canFinance && canHr ? 'xl:grid-cols-2' : ''} gap-6`}>
                  {canFinance && (
                    <Card
                      title={t('Chart of Accounts Summary', 'ملخص دليل الحسابات')}
                      actions={<Button size="sm" variant="ghost" onClick={() => go('accounting')}>{t('Chart of Accounts', 'دليل الحسابات')} →</Button>}
                    >
                      {accounts.length ? (
                        <div className="divide-y divide-sand-border">
                          {accounts.map((a) => (
                            <div key={a.account_type} className="flex items-center justify-between py-2.5 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink-green-900">{acctTypeLabel(a.account_type)}</span>
                                <Badge tone="gray">{a.count} {t('accounts', 'حساب')}</Badge>
                              </div>
                              <span className="font-mono font-bold text-ink-text-primary">{formatMoney(a.balance)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState text={t('No posted ledger accounts yet.', 'لا توجد حسابات مرحلة بعد.')} />
                      )}
                    </Card>
                  )}

                  {canHr && (
                    <Card
                      title={t('HR & Payroll Summary', 'ملخص الموارد البشرية والرواتب')}
                      actions={<Button size="sm" variant="ghost" onClick={() => go('hr')}>{t('Open HR & Staff', 'فتح الموارد البشرية')} →</Button>}
                    >
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between py-1.5 border-b border-sand-border">
                          <span className="text-ink-text-secondary">{t('Active Staff & Tutors', 'الموظفون والمعلمون النشطون')}</span>
                          <span className="font-bold text-ink-green-900">{s.employees ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-sand-border">
                          <span className="text-ink-text-secondary">{t('Pending Staff Leave Requests', 'طلبات إجازة الموظفين المعلقة')}</span>
                          <Badge tone={s.staff_leave_pending ? 'amber' : 'green'}>{s.staff_leave_pending ?? 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-ink-text-secondary">{t('Latest Payroll Run', 'آخر مسير رواتب')}</span>
                          <span className="font-semibold text-ink-text-primary">
                            {pay ? `${pay.period} · ${formatMoney(pay.net)}` : t('Not run yet', 'لم يُنشأ بعد')}
                          </span>
                        </div>
                        {canPayroll && (
                          <div className="pt-2 flex justify-end">
                            <Button size="sm" variant="secondary" onClick={() => go('payroll')}>{t('Manage Payroll', 'إدارة الرواتب')} →</Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {canFinance && (
                <Card
                  title={t('Student Fee Arrears & Guardian Messaging', 'متأخرات رسوم الطلاب ومراسلة أولياء الأمور')}
                  actions={<Button size="sm" variant="ghost" onClick={() => go('fees')}>{t('Open Student Fees', 'فتح رسوم الطلاب')} →</Button>}
                >
                  <Table
                    rows={arrears}
                    rowKey="student_id"
                    empty={t('No outstanding student arrears.', 'لا توجد متأخرات على الطلاب.')}
                    columns={[
                      {
                        key: 'full_name',
                        label: t('Student', 'الطالب'),
                        render: (r) => (
                          <div>
                            <div className="font-semibold text-ink-green-900">{r.full_name}</div>
                            {r.index_number && <div className="text-xs text-ink-text-muted">{r.index_number}</div>}
                          </div>
                        ),
                      },
                      {
                        key: 'class_number',
                        label: t('Class', 'الصف'),
                        render: (r) => (r.class_number ? `${t('Class', 'الصف')} ${r.class_number}` : '—'),
                      },
                      {
                        key: 'guardian_name',
                        label: t('Guardian', 'ولي الأمر'),
                        render: (r) => (
                          <div>
                            <div className="font-medium text-ink-text-primary">{r.guardian_name || t('Not linked', 'غير مرتبط')}</div>
                            {r.guardian_phone && <div className="text-xs text-ink-text-muted" dir="ltr">{r.guardian_phone}</div>}
                          </div>
                        ),
                      },
                      { key: 'oldest_due', label: t('Oldest due', 'أقدم استحقاق'), render: (r) => formatDate(r.oldest_due) },
                      {
                        key: 'balance',
                        label: t('Arrear Balance', 'الرصيد المتأخر'),
                        className: 'text-end',
                        render: (r) => <span className="font-bold text-feedback-danger">{formatMoney(r.balance)}</span>,
                      },
                      {
                        key: 'actions',
                        label: t('Actions', 'الإجراءات'),
                        render: (r) => (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={messagingId === r.student_id}
                              onClick={() => messageGuardian(r)}
                            >
                              {messagingId === r.student_id ? '…' : t('Message Guardian', 'مراسلة ولي الأمر')}
                            </Button>
                            {canRemind && (
                              <Button size="sm" variant="ghost" onClick={() => remindStudent(r)}>
                                {t('Remind', 'تذكير')}
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              )}
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
