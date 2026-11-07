import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PayFeeButton from '../components/PayFeeButton';
import ReceiptsArrears from '../components/ReceiptsArrears';
import { getStudentSubmissions, listAssignmentsForClass } from '../lib/lmsApi';
import { generateFeeReceipt } from '../lib/exportUtils';
import { listActivationEventsForChildren } from '../lib/notifyApi';
import { claimParentInvite } from '../lib/parentInviteApi';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function ParentDashboard() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  
  // Data for selected child
  const [attendance, setAttendance] = useState([]);
  const [results, setResults] = useState([]);
  const [fees, setFees] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [tutorJobs, setTutorJobs] = useState([]);
  const [lmsSubmissions, setLmsSubmissions] = useState([]);
  const [lmsAssignments, setLmsAssignments] = useState([]);
  
  // App state
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [linkIndex, setLinkIndex] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // Leave Form state
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [activationEvents, setActivationEvents] = useState([]);
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
    } catch (err) {
      console.error('Error fetching children:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildData = async (childId) => {
    try {
      setDataLoading(true);

      const [resData, attData, feeData, leaveData, jobData] = await Promise.all([
        supabase.from('student_results').select('*').eq('student_id', childId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', childId).order('date', { ascending: false }),
        supabase.from('student_fees').select('*').eq('student_id', childId).order('month', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('student_id', childId).order('created_at', { ascending: false }),
        supabase.from('tutor_jobs').select('*, profiles(full_name, phone)').limit(5)
      ]);

      if (resData.data) setResults(resData.data);
      if (attData.data) setAttendance(attData.data);
      if (feeData.data && feeData.data.length > 0) setFees(feeData.data[0]);
      else setFees(null);
      if (leaveData.data) setLeaves(leaveData.data);
      if (jobData.data) setTutorJobs(jobData.data);

      if (selectedChild?.class_number) {
        const [assigns, subs] = await Promise.all([
          listAssignmentsForClass(selectedChild.class_number),
          getStudentSubmissions(childId)
        ]);
        setLmsAssignments(assigns);
        setLmsSubmissions(subs);
      }
    } catch (err) {
      console.error('Error fetching child details:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleClaimInvite = async (e) => {
    e.preventDefault();
    setInviteMsg('');
    if (!inviteToken.trim()) return;
    try {
      const result = await claimParentInvite(inviteToken.trim());
      if (!result?.ok) {
        setInviteMsg(result?.error || 'Invite failed');
        return;
      }
      setInviteMsg(tx('تم ربط الطفل عبر الدعوة', 'Child linked via invite'));
      setInviteToken('');
      fetchLinkedChildren();
    } catch (err) {
      setInviteMsg(err.message || 'Invite failed');
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
        setShowLinkModal(false);
        fetchLinkedChildren();
      } else {
        setLinkSuccess(tx('تم إرسال طلب الربط. ستتم الموافقة عليه من قبل إدارة الكلية.', 'Link request sent. The college office will verify and approve it.'));
        setShowLinkModal(false);
      }
    } catch (err) {
      console.error('Error linking child:', err);
      setLinkError(i18n.language === 'ar' ? 'تعذر إرسال طلب الربط' : (err?.message || 'Failed to link child account'));
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
      setLeaveError('Failed to submit leave request');
    }
  };

  // Attendance stats
  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
  const showAttendanceWarning = attendanceRate < 85 && totalDays > 3;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50 text-ink-text-primary">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment-50 text-ink-text-primary py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1240px] mx-auto space-y-8">
        
        {/* 1. Header Banner */}
        <div className="rounded-[14px] bg-ink-green-900 text-paper-white p-7 sm:p-10 shadow-manuscript-md border border-sand-border/20 relative overflow-hidden">
          <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="parent-header-khatam" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-role-parent text-[11px] font-semibold uppercase tracking-wider inline-block">
                {tx('بوابة أولياء الأمور', 'Parent Portal & Guardian Ledger')}
              </span>

              <h1 className="font-serif text-2xl sm:text-4xl font-semibold text-paper-white">
                {tx(`مرحباً بك، ${user?.username}`, `Welcome back, ${user?.username}`)}
              </h1>

              <p className="text-xs sm:text-sm text-dark-text-primary/75 max-w-xl font-sans">
                {tx(
                  'متابعة الحضور والغياب، تقديم طلبات الإجازة، تسوية الرسوم الدراسية، والاطلاع على النتائج الأكاديمية لأبنائك.',
                  'Review residential boarding attendance, submit leave exeats, settle term fees, and examine terminal appraisals for your wards.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>{tx('ربط طالب جديد', 'Link Student Ward')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Child Switcher Chips */}
        {children.length > 0 ? (
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
                    <span className="material-symbols-outlined text-[18px] text-emerald-700">school</span>
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
              onClick={() => setShowLinkModal(true)}
              className="text-xs text-emerald-700 hover:text-ink-green-900 font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>{tx('ربط طالب آخر', 'Link Another Ward')}</span>
            </button>
          </div>
        ) : (
          <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border text-center space-y-4 shadow-manuscript-sm">
            <span className="material-symbols-outlined text-4xl text-brass-gold-500">family_restroom</span>
            <h3 className="font-serif text-lg font-semibold text-ink-green-900">
              {tx('لا توجد حسابات طلاب مرتبطة حتى الآن', 'No Student Accounts Linked Yet')}
            </h3>
            <p className="text-xs text-ink-text-secondary max-w-md mx-auto">
              {tx(
                'اربط حساب ابنك باستخدام رقم القيد الخاص به (مثل: KH-2026-0147) لمتابعة الحضور والنتائج.',
                'Link your child’s college profile using their index number (e.g. KH-2026-0147) to inspect attendance and marks.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="px-5 py-2.5 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold shadow-xs hover:bg-emerald-500"
              >
                {tx('ربط بواسطة رقم القيد', 'Link by Index Number')}
              </button>
            </div>
            {/* Direct invite code redeem */}
            <form onSubmit={handleClaimInvite} className="max-w-xs mx-auto flex gap-2 pt-2">
              <input
                type="text"
                placeholder={tx('أو أدخل رمز الدعوة...', 'Or enter invite token...')}
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                className="flex-1 h-9 px-3 rounded-[8px] bg-parchment-50 border border-sand-border text-xs font-mono"
              />
              <button type="submit" className="px-3 h-9 bg-paper-white border border-sand-border rounded-[8px] text-xs font-semibold hover:bg-mint-wash-100 text-emerald-700">
                {tx('تفعيل', 'Claim')}
              </button>
            </form>
            {inviteMsg && <p className="text-xs text-emerald-700 font-semibold">{inviteMsg}</p>}
          </div>
        )}

        {/* 3. Selected Ward Data Overview */}
        {selectedChild && (
          <div className="space-y-8">
            
            {/* Attendance Alert if low */}
            {showAttendanceWarning && (
              <div className="p-4 rounded-xl bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-xl shrink-0">warning</span>
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

            {/* Quick KPI Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('معدل الحضور', 'Attendance Metric')}
                </span>
                <span className="font-serif text-3xl font-bold text-emerald-700 tabular-nums">
                  {attendanceRate}%
                </span>
                <span className="text-[11px] text-ink-text-muted block mt-1">
                  {presentDays} {tx('حاضر من أصل', 'present of')} {totalDays} {tx('أيام مسجلة', 'recorded days')}
                </span>
              </div>

              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('الرصيد المستحق للرسوم', 'Tuition Balance')}
                </span>
                <span className="font-serif text-3xl font-bold text-brass-gold-500 tabular-nums">
                  LKR {fees ? Math.max(0, (fees.amount || 0) - (fees.paid_amount || 0)).toLocaleString() : '0'}
                </span>
                <span className="text-[11px] text-ink-text-muted block mt-1">
                  {fees?.month ? `${tx('الفاتورة:', 'Billed:')} ${fees.month}` : tx('لا توجد متأخرات نشطة', 'No active arrears')}
                </span>
              </div>

              <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
                  {tx('مشرف الفصل', 'Class Mentor Contact')}
                </span>
                <span className="font-serif text-base font-semibold text-ink-green-900 block truncate">
                  {tutorJobs[0]?.profiles?.full_name || 'Ustaz Abdul Hakeem'}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={`tel:${tutorJobs[0]?.profiles?.phone || '0705668463'}`}
                    className="px-2.5 py-1 rounded bg-sand-border/40 text-[11px] text-ink-text-primary font-semibold hover:bg-emerald-700 hover:text-white transition-colors"
                  >
                    {tx('اتصال', 'Call Tutor')}
                  </a>
                  <a
                    href="https://wa.me/94705668463"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded bg-mint-wash-100 text-[11px] text-emerald-700 font-semibold hover:bg-emerald-700 hover:text-white transition-colors"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Split Grid: Leave Requests & Tuition Statement */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Leave Exeat Request Form & History */}
              <div className="lg:col-span-7 rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-8 shadow-manuscript space-y-6">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block mb-0.5">
                    {tx('التربية والسكن', 'Residential Tarbiyyah')}
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                    {tx('تقديم طلب إجازة / خروج', 'Apply for Leave / Exeat')}
                  </h3>
                  <p className="text-xs text-ink-text-secondary">
                    {tx(
                      'جميع طلبات المبيت والخروج الاضطراري تتطلب موافقة ولي الأمر وتأكيد مشرف السكن.',
                      'All overnight and emergency leaves require parental authorization and warden verification.'
                    )}
                  </p>
                </div>

                {leaveSuccess && (
                  <div className="p-3.5 rounded-lg bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>{tx('تم تسجيل طلب الإجازة وتحويله لمشرف الحلقة.', 'Leave request registered and routed to halaqah supervisor.')}</span>
                  </div>
                )}

                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                        {tx('تاريخ الخروج *', 'Departure Date *')}
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                        {tx('تاريخ العودة المتوقع *', 'Expected Return Date *')}
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                      {tx('سبب الإجازة *', 'Reason for Leave Exeat *')}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      placeholder={tx('مثال: مناسبة عائلية، مراجعة طبية...', 'e.g. Family event, medical appointment...')}
                      className="w-full p-2.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold shadow-xs"
                  >
                    {tx('إرسال طلب الإجازة', 'Submit Leave Request')}
                  </button>
                </form>

                {/* History of Leaves */}
                <div className="pt-6 border-t border-sand-border space-y-3">
                  <h4 className="font-serif text-sm font-semibold text-ink-green-900">
                    {tx('سجل الإجازات السابق', 'Recent Leave History')}
                  </h4>

                  {leaves.length === 0 ? (
                    <p className="text-xs text-ink-text-muted">{tx('لا توجد طلبات إجازة سابقة.', 'No prior leave requests recorded.')}</p>
                  ) : (
                    <div className="space-y-2">
                      {leaves.slice(0, 4).map((l) => {
                        const statusColors = {
                          approved: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20',
                          pending: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/20',
                          rejected: 'bg-feedback-danger/10 text-feedback-danger border-feedback-danger/20'
                        };
                        return (
                          <div key={l.id} className="p-3 rounded-lg border border-sand-border text-xs flex items-center justify-between gap-4">
                            <div>
                              <span className="font-semibold text-ink-text-primary block">{l.reason}</span>
                              <span className="text-[11px] text-ink-text-muted">
                                {l.start_date} → {l.end_date}
                              </span>
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

              {/* Tuition Fees & ERP Receipts */}
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-8 shadow-manuscript space-y-6">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brass-gold-500 block mb-0.5">
                      {tx('الصندوق المالي', 'Waqf Ledger')}
                    </span>
                    <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                      {tx('تسوية الرسوم الدراسية', 'Term Fee Settlements')}
                    </h3>
                  </div>

                  {fees ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-ink-text-muted">{tx('شهر الفاتورة:', 'Billing Month:')}</span>
                          <span className="font-semibold text-ink-green-900">{fees.month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-text-muted">{tx('إجمالي الرسوم:', 'Total Term Dues:')}</span>
                          <span className="font-mono tabular-nums text-ink-text-primary">LKR {fees.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-text-muted">{tx('المدفوع:', 'Paid to Date:')}</span>
                          <span className="font-mono tabular-nums text-emerald-700 font-semibold">LKR {fees.paid_amount || 0}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-sand-border">
                          <span className="font-semibold text-ink-text-primary">{tx('المتبقي:', 'Balance Due:')}</span>
                          <span className="font-mono tabular-nums text-brass-gold-500 font-bold text-sm">
                            LKR {Math.max(0, (fees.amount || 0) - (fees.paid_amount || 0))}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <PayFeeButton fee={fees} />
                        </div>
                        <button
                          type="button"
                          onClick={() => generateFeeReceipt(fees, selectedChild)}
                          className="h-10 px-3.5 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-secondary text-xs flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">receipt</span>
                          <span>{tx('إيصال', 'Receipt')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-parchment-50 border border-sand-border text-center text-xs text-ink-text-muted">
                      {tx('لا توجد فواتير رسوم نشطة حالياً لهذا الطالب.', 'No active term billings on record for this ward.')}
                    </div>
                  )}
                </div>

                {/* ERP Arrears & Receipts Integration */}
                <ReceiptsArrears studentId={selectedChild?.id} />
              </div>

            </div>

            {/* Exam Results Table */}
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
              <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                {tx('التقييمات والدرجات الدراسية', 'Academic Appraisals & Marks')}
              </h3>

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
                            <span className="px-2 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 font-semibold text-[11px]">
                              {r.grade || 'Pass'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Link Child Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-green-900/60 backdrop-blur-xs">
          <div className="max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-8 shadow-manuscript-lg space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {tx('ربط ملف الطالب', 'Link Student Profile')}
              </span>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-secondary hover:bg-sand-border/20"
              >
                ✕
              </button>
            </div>

            <h3 className="font-serif text-2xl font-semibold text-ink-green-900">
              {tx('ربط رقم القيد الأكاديمي', 'Link Son’s Index Number')}
            </h3>

            <p className="text-xs text-ink-text-secondary leading-relaxed">
              {tx(
                'أدخل رقم القيد المخصص للطالب عند قبوله بالكلية (مثال: KH-2026-0147).',
                'Input the collegiate index number assigned to your ward upon admission (e.g., KH-2026-0147).'
              )}
            </p>

            {linkError && (
              <div className="p-3 rounded-lg bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger text-xs font-medium">
                {linkError}
              </div>
            )}

            <form onSubmit={handleLinkChild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                  {tx('رقم قيد الطالب *', 'Student Index Number *')}
                </label>
                <input
                  type="text"
                  required
                  value={linkIndex}
                  onChange={(e) => setLinkIndex(e.target.value)}
                  placeholder="KH-2026-0147"
                  className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs font-mono uppercase text-ink-text-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 border border-sand-border rounded-[10px] text-xs font-medium text-ink-text-secondary"
                >
                  {tx('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold shadow-xs"
                >
                  {tx('ربط الحساب', 'Link Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
