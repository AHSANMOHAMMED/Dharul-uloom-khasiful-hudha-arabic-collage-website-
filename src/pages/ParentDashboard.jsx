import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PayFeeButton from '../components/PayFeeButton';
import ReceiptsArrears from '../components/ReceiptsArrears';
import PortalTabChrome from '../components/portals/PortalTabChrome';
import { claimParentInvite } from '../lib/parentInviteApi';
import { rpc } from '../lib/erp/rpc';
import { getStudentSubmissions, listAssignmentsForClass } from '../lib/lmsApi';
import { listActivationEventsForChildren } from '../lib/notifyApi';
import KhatamPattern from '../components/KhatamPattern';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import { tx } from '../lib/tx';
import { useTabParam } from '../lib/useTabParam';

const PARENT_TABS = ['overview', 'attendance', 'results', 'leaves', 'fees', 'link'];

export default function ParentDashboard() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  // Section lives in ?tab= so Back/Forward, refresh and links work.
  const [activeTab, setActiveTab] = useTabParam(PARENT_TABS, 'overview');
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  
  // Data for selected child
  const [attendance, setAttendance] = useState([]);
  const [results, setResults] = useState([]);
  const [feeArrears, setFeeArrears] = useState(null);
  const [payableFee, setPayableFee] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [tutorJobs, setTutorJobs] = useState([]);
  const [lmsSubmissions, setLmsSubmissions] = useState([]);
  const [lmsAssignments, setLmsAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activationEvents, setActivationEvents] = useState([]);
  
  // App state
  const [loading, setLoading] = useState(true);
  const [linkIndex, setLinkIndex] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  
  // Leave Form state
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    fetchLinkedChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild]);

  const fetchLinkedChildren = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parent_children')
        .select('child_id, profiles!parent_children_child_id_fkey(id, full_name, index_number, class_number)')
        .eq('parent_id', user.id);

      if (error) throw error;
      
      const mappedChildren = (data || []).map(row => row.profiles).filter(Boolean);
      setChildren(mappedChildren);
      setActivationEvents(await listActivationEventsForChildren(mappedChildren.map((c) => c.id)));

      if (mappedChildren.length > 0) {
        setSelectedChild(mappedChildren[0]);
      } else {
        setLoading(false);
      }

      // Pinned announcements for parents
      const { data: annData } = await supabase
        .from('announcements')
        .select('id, title, body, is_pinned, created_at')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false })
        .limit(3);
      if (annData) setAnnouncements(annData);
    } catch (err) {
      console.error('Error fetching children:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildData = async (childId) => {
    try {
      setDataLoading(true);

      const child = children.find((c) => c.id === childId) || selectedChild;
      const classNum = child?.class_number;

      const [resData, attData, leaveData, arrearsResult, feePayData] = await Promise.all([
        supabase.from('student_results').select('*').eq('student_id', childId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', childId).order('date', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('student_id', childId).order('created_at', { ascending: false }),
        rpc('student_arrears', { p_student: childId }).catch(() => null),
        supabase
          .from('student_fees')
          .select('*')
          .eq('student_id', childId)
          .order('month', { ascending: false })
          .limit(3),
      ]);

      let jobData = { data: [] };
      if (classNum != null) {
        const { data: tutorsData } = await supabase.rpc('my_class_tutors', { p_student: childId });
        jobData = {
          data: (tutorsData || []).map((r) => ({
            tutor_id: r.tutor_id,
            title: r.subject,
            profiles: { full_name: r.full_name, phone: r.phone },
          })),
        };
      }

      if (resData.data) setResults(resData.data);
      if (attData.data) setAttendance(attData.data);
      setFeeArrears(arrearsResult);
      const unpaid = (feePayData.data || []).find(
        (f) => f.status !== 'completed' && Number(f.total_due || 0) - Number(f.paid_amount || 0) > 0,
      );
      setPayableFee(unpaid || null);
      if (leaveData.data) setLeaves(leaveData.data);
      if (jobData.data) setTutorJobs(jobData.data);
      else setTutorJobs([]);

      setLmsAssignments(child?.class_number ? await listAssignmentsForClass(child.class_number) : []);
      setLmsSubmissions(await getStudentSubmissions(childId));
    } catch (err) {
      console.error('Error fetching child details:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const tutorProfile = tutorJobs[0]?.profiles;
  const tutorPhoneDigits = tutorProfile?.phone ? String(tutorProfile.phone).replace(/\D/g, '') : '';
  const feeBalance = Number(feeArrears?.total || 0);

  const handleClaimInvite = async (e) => {
    e.preventDefault();
    setInviteMsg('');
    if (!inviteToken.trim()) return;
    try {
      const result = await claimParentInvite(inviteToken.trim());
      if (!result?.ok) {
        setInviteMsg(result?.error || tx('فشل تفعيل الدعوة', 'Invite failed'));
        return;
      }
      setInviteMsg(tx('تم ربط الطفل عبر الدعوة', 'Child linked via invite'));
      setInviteToken('');
      fetchLinkedChildren();
      setActiveTab('overview');
    } catch (err) {
      setInviteMsg(err.message || tx('فشل تفعيل الدعوة', 'Invite failed'));
    }
  };

  const handleLinkChild = async (e) => {
    e.preventDefault();
    setLinkError('');
    setLinkSuccess('');

    if (!linkIndex.trim()) return;

    try {
      // Server-side linking: auto-links when the parent's phone/email matches
      const { data, error } = await supabase.rpc('request_child_link', {
        p_index: linkIndex.trim().toUpperCase(),
        p_relationship: 'guardian',
        p_note: null,
      });
      if (error) throw error;

      setLinkIndex('');
      if (data?.status === 'linked' || data?.status === 'already_linked') {
        setLinkSuccess(tx('تم ربط الحساب بنجاح!', 'Child linked successfully!'));
        fetchLinkedChildren();
        setActiveTab('overview');
      } else {
        setLinkSuccess(tx('تم إرسال طلب الربط. ستتم الموافقة عليه من قبل إدارة الكلية.', 'Link request sent. The college office will verify and approve it.'));
      }
    } catch (err) {
      console.error('Error linking child:', err);
      setLinkError((i18n.language !== 'ar' && err?.message) || tx('تعذر إرسال طلب الربط', 'Failed to link child account'));
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLeaveError('');
    setLeaveSuccess(false);

    if (!selectedChild) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          student_id: selectedChild.id,
          parent_id: user.id,
          start_date: leaveForm.startDate,
          end_date: leaveForm.endDate,
          reason: leaveForm.reason
        });

      if (error) throw error;

      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      setLeaveSuccess(true);
      fetchChildData(selectedChild.id);
    } catch (err) {
      console.error('Error submitting leave request:', err);
      setLeaveError(tx('تعذر إرسال طلب الإجازة', 'Failed to submit leave request'));
    }
  };

  // Attendance stats
  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
  const showAttendanceWarning = attendanceRate < 85 && totalDays > 3;

  const navItems = [
    { id: 'overview', label_en: 'Family Overview', label_ar: 'نظرة عامة', icon: 'family_restroom' },
    { id: 'attendance', label_en: 'Halaqah Presence', label_ar: 'سجل الحضور', icon: 'event_available' },
    { id: 'results', label_en: 'Academic Marksheet', label_ar: 'الشهادات والدرجات', icon: 'history_edu', badge: results.length },
    { id: 'leaves', label_en: 'Leave Exeats', label_ar: 'أذونات الإجازة', icon: 'time_to_leave', badge: leaves.length },
    { id: 'fees', label_en: 'Tuition Ledgers', label_ar: 'الرسوم المدرسية', icon: 'payments' },
    { id: 'link', label_en: 'Link Ward', label_ar: 'ربط طالب', icon: 'person_add' },
  ];

  const childSelector = children.length > 0 ? (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A5E56] font-sans">
        {tx('اختر الطالب للمتابعة', 'Selected Ward')}
      </span>
      <select
        value={selectedChild?.id || ''}
        onChange={(e) => {
          const c = children.find(ch => ch.id === e.target.value);
          if (c) setSelectedChild(c);
        }}
        className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg border border-[#E8E1D0] bg-white text-[#0B3B2E] focus:outline-none"
      >
        {children.map(ch => (
          <option key={ch.id} value={ch.id}>
            {ch.full_name} ({ch.index_number || 'No Index'})
          </option>
        ))}
      </select>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50 text-ink-text-primary">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <DashboardSidebarLayout
      title_en="Parent Portal"
      title_ar="بوابة أولياء الأمور"
      roleBadge={{
        text_en: 'Guardian / Parent',
        text_ar: 'ولي أمر معتمد',
        color: 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30'
      }}
      navItems={navItems}
      activeItem={activeTab}
      onSelect={setActiveTab}
      roleSwitcher={childSelector}
      topActions={
        children.length === 0 ? (
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span className="hidden sm:inline">{tx('ربط طالب', 'Link Ward')}</span>
          </button>
        ) : null
      }
    >
      <div className="space-y-8">

        {activeTab === 'overview' && (
        <div className="rounded-[14px] bg-ink-green-900 text-paper-white p-6 sm:p-8 shadow-manuscript-md border border-sand-border/20 relative overflow-hidden">
          <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="parent-header-khatam" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-role-parent text-[11px] font-semibold uppercase tracking-wider inline-block">
                {tx('بوابة أولياء الأمور', 'Parent Portal & Guardian Ledger')}
              </span>

              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-paper-white">
                {tx(`مرحباً بك، ${user?.username}`, `Welcome back, ${user?.username}`)}
              </h1>

              <p className="text-xs sm:text-sm text-dark-text-primary/75 max-w-xl font-sans">
                {tx(
                  'متابعة الحضور والغياب، تقديم طلبات الإجازة، تسوية الرسوم الدراسية، والاطلاع على النتائج الأكاديمية لأبنائك.',
                  'Review residential boarding attendance, submit leave exeats, settle term fees, and examine terminal appraisals for your wards.'
                )}
              </p>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'overview' && activationEvents.length > 0 && (
          <div className="p-5 rounded-[14px] bg-gold-wash-100 border border-brass-gold-500/30 shadow-xs space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brass-gold-500">
              {tx('تفعيل الطلاب', 'Student activation updates')}
            </h2>
            <ul className="space-y-2">
              {activationEvents.slice(0, 5).map((ev) => (
                <li key={ev.id} className="text-xs text-ink-text-primary border-b border-sand-border/60 pb-2 last:border-0">
                  <div className="font-semibold">{ev.summary}</div>
                  <div className="text-[11px] text-ink-text-muted mt-0.5">
                    {ev.details?.index_number ? `${tx('رقم القيد', 'Index')}: ${ev.details.index_number}` : ''}
                    {ev.details?.class_number != null ? ` · ${tx('الصف', 'Class')} ${ev.details.class_number}` : ''}
                    {' · '}
                    {new Date(ev.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'overview' && announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex items-start gap-3 p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-xs">
                <span className="material-symbols-outlined text-[18px] text-brass-gold-500">{'push_pin'}</span>
                <div>
                  <h3 className="font-serif text-sm font-semibold text-ink-green-900">{ann.title}</h3>
                  <p className="text-xs text-ink-text-secondary mt-0.5">{ann.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (children.length > 0 ? (
          <div className="p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider mr-2">
                {tx('الطالب:', 'Student Ward:')}
              </span>
              {children.map((child) => {
                const isSelected = selectedChild?.id === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChild(child)}
                    className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border transition-all ${
                      isSelected
                        ? 'bg-mint-wash-100 border-emerald-700 text-ink-green-900 font-semibold ring-1 ring-emerald-700'
                        : 'bg-parchment-50 border-sand-border hover:bg-sand-border/30 text-ink-text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-emerald-700">{'school'}</span>
                    <span className="text-xs">{child.full_name}</span>
                    {child.index_number && (
                      <span className="font-mono text-[10px] text-ink-text-muted">({child.index_number})</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className="text-xs text-emerald-700 hover:text-ink-green-900 font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">{'add'}</span>
              <span>{tx('ربط طالب آخر', 'Link another')}</span>
            </button>
          </div>
        ) : (
          <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border text-center space-y-4 shadow-manuscript-sm">
            <span className="material-symbols-outlined text-4xl text-brass-gold-500">{'family_restroom'}</span>
            <h3 className="font-serif text-lg font-semibold text-ink-green-900">
              {tx('لا توجد حسابات طلاب مرتبطة حتى الآن', 'No Student Accounts Linked Yet')}
            </h3>
            <p className="text-xs text-ink-text-secondary max-w-md mx-auto">
              {tx(
                'اربط حساب ابنك برقم القيد أو رمز الدعوة من تبويب ربط طالب.',
                'Link your child with an index number or invite code from the Link Ward tab.',
              )}
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className="px-5 py-2.5 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold shadow-xs hover:bg-emerald-500"
            >
              {tx('فتح ربط طالب', 'Open Link Ward')}
            </button>
          </div>
        ))}

        {selectedChild && dataLoading && activeTab !== 'link' && (
          <div className="h-40 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {!selectedChild && activeTab !== 'overview' && activeTab !== 'link' && (
          <p className="text-xs text-ink-text-muted text-center py-8">
            {tx('اختر طالباً من القائمة الجانبية لمتابعة البيانات.', 'Select a ward from the sidebar to view records.')}
          </p>
        )}

        {selectedChild && !dataLoading && activeTab === 'overview' && (
          <div className="space-y-8">
            {showAttendanceWarning && (
              <div className="p-4 rounded-xl bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-xl shrink-0">{'warning'}</span>
                <div>
                  <h4 className="font-semibold">{tx('تجاوز حد الغياب المسموح به', 'Absence Threshold Exceeded')}</h4>
                  <p className="mt-0.5">
                    {tx(
                      `نسبة حضور الطالب في الحلقات حالياً هي ${attendanceRate}% (الحد الأدنى المطلوب 85%). يرجى التواصل مع مشرف الفصل.`,
                      `Your ward's halaqah attendance is currently ${attendanceRate}% (required minimum is 85%). Please contact their class mentor.`
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('معدل الحضور', 'Attendance Metric')}
                </span>
                <span className="font-serif text-3xl font-bold text-emerald-700 tabular-nums">{attendanceRate}%</span>
                <span className="text-[11px] text-ink-text-muted block mt-1">
                  {presentDays} {tx('حاضر من أصل', 'present of')} {totalDays} {tx('أيام مسجلة', 'recorded days')}
                </span>
              </div>

              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('الرصيد المستحق للرسوم', 'Tuition Balance')}
                </span>
                <span className="font-serif text-3xl font-bold text-brass-gold-500 tabular-nums">
                  {tx('روبية', 'LKR')} {feeBalance.toLocaleString()}
                </span>
                <span className="text-[11px] text-ink-text-muted block mt-1">
                  {feeBalance > 0 ? tx('متأخرات مسجلة في ERP', 'Arrears on ERP ledger') : tx('لا توجد متأخرات نشطة', 'No active arrears')}
                </span>
              </div>

              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('مشرف الفصل', 'Class Mentor Contact')}
                </span>
                <span className="font-serif text-base font-semibold text-ink-green-900 block truncate">
                  {tutorProfile?.full_name || tx('لا يوجد مشرف معيّن', 'No tutor assigned')}
                </span>
                {tutorProfile?.phone && (
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={`tel:${tutorProfile.phone}`}
                      className="px-2.5 py-1 rounded bg-sand-border/40 text-[11px] text-ink-text-primary font-semibold hover:bg-emerald-700 hover:text-white transition-colors"
                    >
                      {tx('اتصال', 'Call Tutor')}
                    </a>
                    {tutorPhoneDigits && (
                      <a
                        href={`https://wa.me/${tutorPhoneDigits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-mint-wash-100 text-[11px] text-emerald-700 font-semibold hover:bg-emerald-700 hover:text-white transition-colors"
                      >
                        {tx('واتساب', 'WhatsApp')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedChild && !dataLoading && activeTab === 'attendance' && (
          <PortalTabChrome
            title_en="Halaqah Attendance"
            title_ar="سجل الحضور"
            subtitle_en={`Records for ${selectedChild.full_name}`}
            subtitle_ar={`سجل ${selectedChild.full_name}`}
            onBack={() => setActiveTab('overview')}
            onPrint={() => window.print()}
          >
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4 print:shadow-none">
              {attendance.length === 0 ? (
                <p className="text-xs text-ink-text-muted text-center py-6">{tx('لا توجد سجلات حضور بعد.', 'No attendance records yet.')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-sand-border bg-parchment-50 text-ink-text-secondary uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">{tx('التاريخ', 'Date')}</th>
                        <th className="py-2.5 px-3">{tx('الحالة', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-border/60">
                      {attendance.map((a) => (
                        <tr key={a.id || `${a.date}-${a.status}`} className="hover:bg-parchment-50/50">
                          <td className="py-2.5 px-3 font-mono text-ink-text-primary">{a.date}</td>
                          <td className="py-2.5 px-3 capitalize text-ink-text-secondary">{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </PortalTabChrome>
        )}

        {selectedChild && !dataLoading && activeTab === 'results' && (
          <PortalTabChrome
            title_en="Academic Marksheet"
            title_ar="الشهادات والدرجات"
            onBack={() => setActiveTab('overview')}
          >
            <div className="space-y-6">
              <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
                {results.length === 0 ? (
                  <p className="text-xs text-ink-text-muted py-4 text-center">
                    {tx('لم تُنشر أي درجات لهذا الطالب بعد.', 'No term marks published for this student yet.')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-sand-border bg-parchment-50 text-ink-text-secondary uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3">{tx('المادة', 'Subject')}</th>
                          <th className="py-2.5 px-3">{tx('الفصل / الاختبار', 'Exam Term')}</th>
                          <th className="py-2.5 px-3 text-right">{tx('الدرجة', 'Marks')}</th>
                          <th className="py-2.5 px-3 text-center">{tx('التقدير', 'Grade')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-border/60">
                        {results.map((r, i) => (
                          <tr key={r.id || i} className="hover:bg-parchment-50/50">
                            <td className="py-2.5 px-3 font-medium text-ink-text-primary">{r.subject}</td>
                            <td className="py-2.5 px-3 text-ink-text-muted">{r.exam_name}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-ink-green-900 tabular-nums">{r.marks ?? '-'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 font-semibold text-[11px">
                                {r.grade || tx('ناجح', 'Pass')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-3">
                <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                  {tx('الواجبات والتقدم', 'Assignments & Progress')}
                </h3>
                {lmsAssignments.length === 0 ? (
                  <p className="text-xs text-ink-text-muted">{tx('لا واجبات حالياً', 'No assignments yet')}</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {lmsAssignments.map((a) => {
                      const sub = lmsSubmissions.find((s) => s.assignment_id === a.id);
                      return (
                        <li key={a.id} className="p-3 rounded-lg border border-sand-border flex justify-between gap-2">
                          <span className="font-medium text-ink-text-primary">{a.title}</span>
                          <span className={`text-[11px] font-semibold shrink-0 ${sub ? 'text-emerald-700' : 'text-brass-gold-500'}`}>
                            {sub
                              ? (sub.grade ? `${tx('الدرجة', 'Grade')} ${sub.grade}` : tx('تم التسليم', 'Submitted'))
                              : (a.due_date ? `${tx('موعد التسليم', 'Due')} ${a.due_date}` : tx('قيد الانتظار', 'Pending'))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </PortalTabChrome>
        )}

        {selectedChild && !dataLoading && activeTab === 'leaves' && (
          <PortalTabChrome
            title_en="Leave Exeats"
            title_ar="أذونات الإجازة"
            onBack={() => setActiveTab('overview')}
          >
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-8 shadow-manuscript space-y-6">
              {leaveSuccess && (
                <div className="p-3.5 rounded-lg bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">{'check_circle'}</span>
                  <span>{tx('تم تسجيل طلب الإجازة وتحويله لمشرف الحلقة.', 'Leave request registered and routed to halaqah supervisor.')}</span>
                </div>
              )}

              <form onSubmit={handleLeaveSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">{tx('تاريخ الخروج *', 'Departure Date *')}</label>
                    <input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">{tx('تاريخ العودة المتوقع *', 'Expected Return Date *')}</label>
                    <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-text-primary mb-1">{tx('سبب الإجازة *', 'Reason for Leave Exeat *')}</label>
                  <textarea rows={2} required value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="w-full p-2.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs" />
                </div>
                <button type="submit" className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold shadow-xs">
                  {tx('إرسال طلب الإجازة', 'Submit Leave Request')}
                </button>
                {leaveError && <p className="text-xs text-feedback-danger font-medium">{leaveError}</p>}
              </form>

              <div className="pt-6 border-t border-sand-border space-y-3">
                <h4 className="font-serif text-sm font-semibold text-ink-green-900">{tx('سجل الإجازات السابق', 'Recent Leave History')}</h4>
                {leaves.length === 0 ? (
                  <p className="text-xs text-ink-text-muted">{tx('لا توجد طلبات إجازة سابقة.', 'No prior leave requests recorded.')}</p>
                ) : (
                  <div className="space-y-2">
                    {leaves.map((l) => {
                      const statusColors = {
                        approved: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20',
                        pending: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/20',
                        rejected: 'bg-feedback-danger/10 text-feedback-danger border-feedback-danger/20',
                      };
                      return (
                        <div key={l.id} className="p-3 rounded-lg border border-sand-border text-xs flex items-center justify-between gap-4">
                          <div>
                            <span className="font-semibold text-ink-text-primary block">{l.reason}</span>
                            <span className="text-[11px] text-ink-text-muted">{l.start_date} → {l.end_date}</span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase border ${statusColors[l.status] || statusColors.pending}`}>
                            {l.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </PortalTabChrome>
        )}

        {selectedChild && !dataLoading && activeTab === 'fees' && (
          <PortalTabChrome
            title_en="Tuition Ledgers"
            title_ar="الرسوم المدرسية"
            onBack={() => setActiveTab('overview')}
          >
            <div className="space-y-6">
              <ReceiptsArrears studentId={selectedChild.id} />
              {payableFee && (
                <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
                  <p className="text-xs text-ink-text-muted mb-3">{tx('دفع عبر الإنترنت (إن وُجدت فاتورة نشطة)', 'Online payment when an active bill exists')}</p>
                  <PayFeeButton fee={payableFee} />
                </div>
              )}
            </div>
          </PortalTabChrome>
        )}

        {activeTab === 'link' && (
          <PortalTabChrome
            title_en="Link Ward"
            title_ar="ربط طالب"
            subtitle_en="One place for index number or invite code"
            subtitle_ar="مكان واحد لرقم القيد أو رمز الدعوة"
            onBack={() => setActiveTab('overview')}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                    {tx('برقم القيد', 'By index number')}
                  </h3>
                  <p className="text-xs text-ink-text-secondary mt-1">
                    {tx(
                      'أدخل رقم القيد (مثال: KH-2026-0147). إن تطابق الهاتف/البريد يُربط تلقائياً، وإلا يُرسل طلب للموافقة.',
                      'Enter the collegiate index (e.g. KH-2026-0147). Matching phone/email auto-links; otherwise a request is sent for approval.',
                    )}
                  </p>
                </div>
                {linkError && (
                  <div className="p-3 rounded-lg bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger text-xs font-medium">
                    {linkError}
                  </div>
                )}
                {linkSuccess && (
                  <div className="p-3 rounded-lg bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-semibold">
                    {linkSuccess}
                  </div>
                )}
                <form onSubmit={handleLinkChild} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={linkIndex}
                    onChange={(e) => setLinkIndex(e.target.value)}
                    placeholder="KH-2026-0147"
                    className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs font-mono uppercase"
                  />
                  <button type="submit" className="w-full h-11 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold shadow-xs">
                    {tx('ربط الحساب', 'Link account')}
                  </button>
                </form>
              </div>

              <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                    {tx('برمز الدعوة', 'By invite code')}
                  </h3>
                  <p className="text-xs text-ink-text-secondary mt-1">
                    {tx(
                      'إن أرسلت لك الكلية رمز دعوة ولي الأمر، أدخله هنا لتفعيل الربط فوراً.',
                      'If the college sent you a parent invite token, enter it here for an instant link.',
                    )}
                  </p>
                </div>
                {inviteMsg && (
                  <div className="p-3 rounded-lg bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-semibold">
                    {inviteMsg}
                  </div>
                )}
                <form onSubmit={handleClaimInvite} className="space-y-3">
                  <input
                    type="text"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder={tx('رمز الدعوة…', 'Invite token…')}
                    className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs font-mono"
                  />
                  <button type="submit" className="w-full h-11 bg-ink-green-900 hover:bg-emerald-700 text-white rounded-[10px] text-xs font-semibold shadow-xs">
                    {tx('تفعيل الدعوة', 'Claim invite')}
                  </button>
                </form>
              </div>
            </div>
          </PortalTabChrome>
        )}

      </div>
    </DashboardSidebarLayout>
  );
}
