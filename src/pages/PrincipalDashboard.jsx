import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';
import { useTabParam } from '../lib/useTabParam';

const PRINCIPAL_TABS = ['overview', 'announcements', 'leaves', 'approvals', 'timetable', 'results'];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASSES = [1, 2, 3, 4, 5, 6, 7];

const PrincipalDashboard = ({ vpMode = false }) => {
  const { user, logout } = useAuth();
  useTranslation(); // re-render on language change

  const [activeTab, setActiveTab] = useTabParam(
    vpMode ? PRINCIPAL_TABS.filter((id) => id !== 'approvals') : PRINCIPAL_TABS,
    'overview'
  );
  const [loading, setLoading] = useState(true);

  // Overview stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    pendingLeaves: 0,
    pendingApprovals: 0,
    monthlyFeeCollected: 0,
    monthlyFeeOutstanding: 0,
  });

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const [announceSaving, setAnnounceSaving] = useState(false);

  // Leave requests
  const [leaves, setLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveNote, setLeaveNote] = useState('');
  const [leaveProcessing, setLeaveProcessing] = useState(false);

  // Tutor approvals (principal only)
  const [pendingTutors, setPendingTutors] = useState([]);
  const [approving, setApproving] = useState(null);

  // Schedules
  const [schedules, setSchedules] = useState([]);
  const [tutorsList, setTutorsList] = useState([]);
  const [schedForm, setSchedForm] = useState({
    tutor_id: '', class_number: 1, subject: '', day_of_week: 'Monday',
    start_time: '08:00', end_time: '09:00', room: '', academic_year: 2026
  });
  const [schedSaving, setSchedSaving] = useState(false);

  // Results overview
  const [results, setResults] = useState([]);

  const thisMonth = new Date().toISOString().slice(0, 7);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const responses = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'student').eq('is_approved', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'tutor').eq('is_approved', true),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false).in('account_type', ['student', 'tutor']),
        supabase.from('student_fees').select('total_due, paid_amount, status').eq('month', thisMonth),
        supabase.from('announcements').select('*, profiles!announcements_author_id_fkey(full_name)').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20),
        supabase.from('leave_requests').select('*, profiles!leave_requests_student_id_fkey(full_name, class_number)').eq('status', 'pending').order('created_at', { ascending: false }),
        vpMode ? Promise.resolve({ data: [] }) :
          supabase.from('profiles').select('*').eq('account_type', 'tutor').eq('is_approved', false).order('created_at', { ascending: false }),
        supabase.from('class_schedules').select('*, profiles!class_schedules_tutor_id_fkey(full_name)').order('day_of_week').order('start_time'),
        supabase.from('profiles').select('id, full_name').eq('account_type', 'tutor').eq('is_approved', true).order('full_name'),
        supabase.from('student_results').select('*, profiles!student_results_student_id_fkey(full_name, class_number)').order('created_at', { ascending: false }).limit(50),
      ]);
      // supabase-js reports failures in `error` instead of throwing — surface them
      // but keep whatever panels did load.
      const failures = responses.filter((r) => r?.error);
      if (failures.length) {
        failures.forEach((r) => console.error('Principal dashboard query failed:', r.error));
        toast.warn(tx('تعذر تحميل بعض بيانات اللوحة', 'Some dashboard data could not be loaded'));
      }
      const [
        { count: stuCount },
        { count: tutCount },
        { count: leaveCount },
        { count: approvalCount },
        { data: feesData },
        { data: annData },
        { data: leaveData },
        { data: tutorApprovals },
        { data: schedData },
        { data: tutorsList },
        { data: resultsData },
      ] = responses;

      const collected = feesData?.reduce((s, r) => s + (r.paid_amount || 0), 0) ?? 0;
      const outstanding = feesData?.reduce((s, r) => s + Math.max(0, (r.total_due || 0) - (r.paid_amount || 0)), 0) ?? 0;

      setStats({
        totalStudents: stuCount ?? 0,
        totalTutors: tutCount ?? 0,
        pendingLeaves: leaveCount ?? 0,
        pendingApprovals: approvalCount ?? 0,
        monthlyFeeCollected: collected,
        monthlyFeeOutstanding: outstanding,
      });
      setAnnouncements(annData || []);
      setLeaves(leaveData || []);
      setPendingTutors(tutorApprovals || []);
      setSchedules(schedData || []);
      setTutorsList(tutorsList || []);
      setResults(resultsData || []);
    } catch (err) {
      console.error('Principal dashboard error:', err);
      toast.error(tx('تعذر تحميل بيانات لوحة التحكم', 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }, [user, thisMonth, vpMode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Announcement handlers ──────────────────────────────────────────────────
  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setAnnounceSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        author_id: user.id,
        title: newTitle.trim(),
        body: newBody.trim(),
        is_pinned: newPinned,
        target_roles: [],
      });
      if (error) throw error;
      toast.success(tx('تم نشر الإعلان بنجاح', 'Announcement posted!'));
      setNewTitle(''); setNewBody(''); setNewPinned(false);
      fetchAll();
    } catch (err) {
      toast.error('Failed to post: ' + err.message);
    } finally {
      setAnnounceSaving(false);
    }
  };

  const handleTogglePin = async (ann) => {
    await supabase.from('announcements').update({ is_pinned: !ann.is_pinned }).eq('id', ann.id);
    fetchAll();
  };

  const handleDeleteAnnouncement = async (id) => {
    await supabase.from('announcements').delete().eq('id', id);
    toast.info(tx('تم حذف الإعلان', 'Announcement deleted'));
    fetchAll();
  };

  // ── Leave review ───────────────────────────────────────────────────────────
  const handleReviewLeave = async (status) => {
    if (!selectedLeave) return;
    setLeaveProcessing(true);
    try {
      const { error } = await supabase.from('leave_requests').update({
        status, response_note: leaveNote, reviewed_by: user.id
      }).eq('id', selectedLeave.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: selectedLeave.student_id,
        title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your leave (${selectedLeave.start_date} – ${selectedLeave.end_date}) was ${status}. ${leaveNote ? 'Note: ' + leaveNote : ''}`
      });
      toast.success(status === 'approved' ? tx('تم قبول الإجازة', 'Leave approved') : tx('تم رفض الإجازة', 'Leave rejected'));
      setSelectedLeave(null); setLeaveNote('');
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLeaveProcessing(false);
    }
  };

  // ── Tutor approval ─────────────────────────────────────────────────────────
  const handleTutorApproval = async (tutorId, approve) => {
    setApproving(tutorId);
    try {
      const { error: approveErr } = await supabase.rpc('approve_account', { p_profile_id: tutorId, p_approve: approve });
      // approve_account checks the principal's rights server-side and notifies the user.
      if (approveErr) throw approveErr;
      if (!approve) {
        await supabase.from('notifications').insert({
          user_id: tutorId,
          title: 'Account Registration Status',
          message: 'Your tutor account registration has not been approved at this time.',
        });
      }
      toast.success(approve ? (tx('تم اعتماد المعلم', 'Tutor approved!')) : (tx('تم رفض الحساب', 'Tutor rejected')));
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(null);
    }
  };

  // ── Schedule creation ──────────────────────────────────────────────────────
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!schedForm.tutor_id || !schedForm.subject) return;
    setSchedSaving(true);
    try {
      const { error } = await supabase.from('class_schedules').insert(schedForm);
      if (error) throw error;
      toast.success(tx('تمت إضافة الحصة بنجاح', 'Schedule entry added!'));
      setSchedForm(f => ({ ...f, subject: '', room: '' }));
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSchedSaving(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    await supabase.from('class_schedules').delete().eq('id', id);
    toast.info(tx('تم حذف الحصة', 'Schedule entry removed'));
    fetchAll();
  };

  // ── Timetable grid builder ─────────────────────────────────────────────────
  const buildTimetableGrid = () => {
    const grid = {};
    DAYS.forEach(d => { grid[d] = {}; CLASSES.forEach(c => { grid[d][c] = []; }); });
    schedules.forEach(s => {
      if (grid[s.day_of_week]?.[s.class_number] !== undefined) {
        grid[s.day_of_week][s.class_number].push(s);
      }
    });
    return grid;
  };

  // ── Tabs config with outline SVGs ──────────────────────────────────────────
  const tabs = [
    {
      id: 'overview',
      label: tx('نظرة عامة', 'Overview'),
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'announcements',
      label: tx('الإعلانات', 'Announcements'),
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )
    },
    {
      id: 'leaves',
      label: tx('الإجازات', 'Leave Requests'),
      badge: leaves.length,
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    ...(!vpMode ? [{
      id: 'approvals',
      label: tx('الموافقات', 'Approvals'),
      badge: pendingTutors.length,
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }] : []),
    {
      id: 'timetable',
      label: tx('الجدول الدراسي', 'Timetable'),
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'results',
      label: tx('النتائج', 'Results'),
      icon: (
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#0B3B2E] border-t-transparent animate-spin"></div>
          <p className="text-sm font-sans text-[#4A5E56]">
            {tx('جاري تحميل لوحة القيادة الأكاديمية...', 'Loading governance dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  const timetableGrid = buildTimetableGrid();
  const roleColor = vpMode ? '#3949AB' : '#0B3B2E';
  const roleBg = vpMode ? '#E8EAF6' : '#E3F1EA';

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] relative overflow-hidden py-8 sm:py-12">
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="principal-khatam" />
      </div>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">

        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: roleColor }}></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-arabic text-2xl sm:text-3xl font-bold shrink-0 shadow-sm border"
                style={{ backgroundColor: roleBg, color: roleColor, borderColor: `${roleColor}30` }}
              >
                {vpMode ? 'ن' : 'ع'}
              </div>
              <div>
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-1.5"
                  style={{ backgroundColor: roleBg, color: roleColor, borderColor: `${roleColor}30` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: roleColor }}></span>
                  {vpMode ? (tx('ديوان نائب الناظر', 'Office of the Vice Principal')) : (tx('ديوان الناظر العام', 'Office of the Principal'))}
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                  {tx('فضيلة الشيخ {name}', 'Sheikh {name}').replace('{name}', user?.username || tx('المدير', 'Executive'))}
                </h1>
                <p className="text-xs sm:text-sm text-[#4A5E56] font-sans mt-0.5">
                  {tx('الحوكمة الأكاديمية الشاملة، الإعلانات الرسمية، الجداول والنتائج', 'Academic governance, faculty management, timetable scheduling & student evaluations')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm"
              >
                <svg className="w-4 h-4 text-[#11694A] stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {tx('المكتبة الرقمية', 'Digital Library')}
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-sans font-semibold text-xs sm:text-sm rounded-xl transition"
              >
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {tx('خروج', 'Logout')}
              </button>
            </div>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-[#E8E1D0] shadow-sm flex overflow-x-auto gap-1 hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-sans font-semibold text-xs sm:text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0B3B2E] text-white shadow-sm'
                  : 'text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-[#FBF8F0]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-[#C29A3A] text-[#0B3B2E]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid: 6 KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: tx('الطلاب المعتمدون', 'Active Students'), value: stats.totalStudents, badge: 'Enrolled' },
                { label: tx('أعضاء التدريس', 'Active Faculty'), value: stats.totalTutors, badge: 'Faculty' },
                { label: tx('إجازات معلقة', 'Pending Leaves'), value: stats.pendingLeaves, badge: 'Action Req' },
                { label: tx('موافقات معلقة', 'Pending Signups'), value: stats.pendingApprovals, badge: 'Review' },
                { label: tx('رسوم محصلة', 'Fees Collected'), value: `LKR ${stats.monthlyFeeCollected.toLocaleString()}`, badge: 'MTD' },
                { label: tx('متأخرات الرسوم', 'Outstanding'), value: `LKR ${stats.monthlyFeeOutstanding.toLocaleString()}`, badge: 'Arrears' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#E8E1D0] p-4 text-center shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C29A3A]">
                    {stat.badge}
                  </span>
                  <div className="text-xl lg:text-2xl font-serif font-bold text-[#0B3B2E] font-mono tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-[#4A5E56] font-medium leading-tight">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Announcements preview */}
            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E1D0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-[#0B3B2E]">
                    {tx('آخر الإعلانات والتعميمات', 'Recent College Circulars')}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('announcements')}
                  className="text-xs font-bold text-[#11694A] hover:underline"
                >
                  {tx('إدارة الإعلانات', 'Manage All')} →
                </button>
              </div>

              {announcements.slice(0, 3).map(ann => (
                <div key={ann.id} className="p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex gap-3.5 items-start">
                  {ann.is_pinned ? (
                    <span className="w-7 h-7 rounded-lg bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center shrink-0 text-xs font-bold">
                      📌
                    </span>
                  ) : (
                    <span className="w-7 h-7 rounded-lg bg-white border border-[#E8E1D0] text-[#4A5E56] flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0B3B2E] text-sm">{ann.title}</p>
                    <p className="text-xs text-[#4A5E56] mt-1 line-clamp-2 leading-relaxed">{ann.body}</p>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <p className="text-center text-xs text-[#4A5E56] py-6">
                  {tx('لا توجد إعلانات منشورة بعد.', 'No circulars posted yet.')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── ANNOUNCEMENTS TAB ─────────────────────────────────────── */}
        {activeTab === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Post new */}
            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('إنشاء إعلان رسمي جديد', 'Publish College Circular')}
              </h2>
              <form onSubmit={handlePostAnnouncement} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                    {tx('العنوان', 'Title')}
                  </label>
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                    placeholder={tx('عنوان الإعلان أو التعميم...', 'Circular heading...')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                    {tx('المحتوى', 'Content Body')}
                  </label>
                  <textarea
                    value={newBody}
                    onChange={e => setNewBody(e.target.value)}
                    rows={4}
                    className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#11694A] resize-none"
                    placeholder={tx('نص التعميم الأكاديمي أو التوجيهي...', 'Full text of the announcement...')}
                    required
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newPinned}
                    onChange={e => setNewPinned(e.target.checked)}
                    className="rounded text-[#C29A3A] focus:ring-[#C29A3A]"
                  />
                  <span className="text-xs text-[#0B3B2E] font-medium">
                    {tx('تثبيت الإعلان في أعلى البوابة', 'Pin this circular to top of dashboard')}
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={announceSaving}
                  className="w-full py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#60736C] text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-sm"
                >
                  {announceSaving ? (tx('جاري النشر...', 'Publishing...')) : (tx('نشر الإعلان', 'Publish Circular'))}
                </button>
              </form>
            </div>

            {/* Existing announcements */}
            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('الإعلانات المنشورة', 'Active Circulars')}
              </h2>
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {announcements.map(ann => (
                  <div key={ann.id} className="p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#0B3B2E] text-sm truncate">
                          {ann.is_pinned && <span className="text-[#C29A3A] mr-1">📌</span>}
                          {ann.title}
                        </p>
                        <p className="text-[10px] text-[#4A5E56]">
                          by {ann.profiles?.full_name || 'Admin'} · {new Date(ann.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleTogglePin(ann)}
                          title={tx('تثبيت / إلغاء التثبيت', 'Toggle pin')}
                          className={`p-1.5 rounded-lg text-xs font-bold transition ${
                            ann.is_pinned ? 'bg-[#F7EDD2] text-[#C29A3A]' : 'bg-white border border-[#E8E1D0] text-[#4A5E56]'
                          }`}
                        >
                          📌
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-xs bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FCA5A5] transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#4A5E56] line-clamp-2 leading-relaxed">{ann.body}</p>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="text-center text-xs text-[#4A5E56] py-8">
                    {tx('لا توجد إعلانات بعد.', 'No circulars posted yet.')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LEAVE REQUESTS TAB ────────────────────────────────────── */}
        {activeTab === 'leaves' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#E8E1D0]">
                <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                  {tx('طلبات الإجازات المعلقة ({n})', 'Pending Leave Requests ({n})').replace('{n}', leaves.length)}
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] tabular-nums">
                  {leaves.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {leaves.map(lv => (
                  <div
                    key={lv.id}
                    onClick={() => { setSelectedLeave(lv); setLeaveNote(''); }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedLeave?.id === lv.id
                        ? 'border-[#11694A] bg-[#E3F1EA]/50 font-semibold'
                        : 'border-[#E8E1D0] bg-[#FBF8F0] hover:border-[#11694A]/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#0B3B2E] text-sm">{lv.profiles?.full_name}</span>
                      <span className="text-[10px] bg-white text-[#4A5E56] border border-[#E8E1D0] px-2 py-0.5 rounded-full">
                        {tx('الصف', 'Class')} {lv.profiles?.class_number}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4A5E56] font-mono mt-1 tabular-nums">{lv.start_date} → {lv.end_date}</p>
                    <p className="text-xs text-[#14201B] italic mt-1 line-clamp-1">&quot;{lv.reason}&quot;</p>
                  </div>
                ))}
                {leaves.length === 0 && (
                  <p className="text-center text-xs text-[#4A5E56] py-12">
                    ✓ {tx('لا توجد طلبات إجازة معلقة.', 'All leave requests are cleared!')}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('مراجعة واعتماد الطلب', 'Review Selected Leave')}
              </h2>
              {selectedLeave ? (
                <div className="space-y-4">
                  <div className="p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl space-y-1.5">
                    <p className="font-bold text-[#0B3B2E] text-sm">{selectedLeave.profiles?.full_name}</p>
                    <p className="text-[11px] text-[#4A5E56] font-mono tabular-nums">{selectedLeave.start_date} → {selectedLeave.end_date}</p>
                    <p className="text-xs text-[#14201B] bg-white p-2 rounded-lg border border-[#E8E1D0] mt-1">{selectedLeave.reason}</p>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('ملاحظة الرد (اختياري)', 'Feedback / Response Note')}
                    </label>
                    <textarea
                      value={leaveNote}
                      onChange={e => setLeaveNote(e.target.value)}
                      rows={3}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] text-xs rounded-xl p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                      placeholder={tx('ملاحظة توجيهية للطالب أو المعلم...', 'Optional approval / rejection remark...')}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReviewLeave('approved')}
                      disabled={leaveProcessing}
                      className="flex-1 py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#60736C] text-white font-bold rounded-xl text-xs transition"
                    >
                      ✓ {tx('قبول الإجازة', 'Approve')}
                    </button>
                    <button
                      onClick={() => handleReviewLeave('rejected')}
                      disabled={leaveProcessing}
                      className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-[#60736C] text-white font-bold rounded-xl text-xs transition"
                    >
                      ✕ {tx('رفض الإجازة', 'Reject')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-[#4A5E56] text-xs">
                  {tx('اختر طلباً من القائمة لمراجعته.', 'Select a leave request from the list to review.')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TUTOR APPROVALS TAB (Principal only) ──────────────────── */}
        {activeTab === 'approvals' && !vpMode && (
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-[#E8E1D0]">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('موافقات المعلمين المعلقة ({n})', 'Pending Tutor Approvals ({n})').replace('{n}', pendingTutors.length)}
              </h2>
            </div>
            {pendingTutors.length === 0 ? (
              <p className="text-center text-xs text-[#4A5E56] py-12">
                ✓ {tx('لا توجد طلبات تسجيل معلمين جديدة.', 'No pending tutor registrations.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingTutors.map(tutor => (
                  <div key={tutor.id} className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#E3F1EA] text-[#11694A] flex items-center justify-center font-bold">
                        {tutor.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-[#0B3B2E] text-sm">{tutor.full_name}</p>
                        <p className="text-[10px] text-[#4A5E56]">{tutor.email}</p>
                      </div>
                    </div>
                    {tutor.phone && <p className="text-xs text-[#4A5E56]">{tx('الهاتف:', 'Phone:')} {tutor.phone}</p>}
                    <p className="text-[10px] text-[#4A5E56]">
                      {tx('تاريخ التسجيل', 'Registered')}: {new Date(tutor.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTutorApproval(tutor.id, true)}
                        disabled={approving === tutor.id}
                        className="flex-1 py-1.5 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-xl text-xs transition disabled:bg-[#60736C]"
                      >
                        {tx('قبول', 'Approve')}
                      </button>
                      <button
                        onClick={() => handleTutorApproval(tutor.id, false)}
                        disabled={approving === tutor.id}
                        className="flex-1 py-1.5 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-bold rounded-xl text-xs transition disabled:bg-gray-200"
                      >
                        {tx('رفض', 'Reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TIMETABLE TAB ─────────────────────────────────────────── */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            {/* Add schedule form (principal only) */}
            {!vpMode && (
              <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
                <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                  {tx('إضافة حصة دراسية للجدول', 'Add Weekly Schedule Slot')}
                </h2>
                <form onSubmit={handleAddSchedule} className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('المعلم', 'Tutor')}
                    </label>
                    <select
                      value={schedForm.tutor_id}
                      onChange={e => setSchedForm(f => ({ ...f, tutor_id: e.target.value }))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                    >
                      <option value="">{tx('اختر معلماً...', 'Select tutor...')}</option>
                      {tutorsList.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('الصف', 'Class')}
                    </label>
                    <select
                      value={schedForm.class_number}
                      onChange={e => setSchedForm(f => ({ ...f, class_number: +e.target.value }))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    >
                      {CLASSES.map(c => <option key={c} value={c}>{tx('الصف', 'Class')} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('اليوم', 'Day')}
                    </label>
                    <select
                      value={schedForm.day_of_week}
                      onChange={e => setSchedForm(f => ({ ...f, day_of_week: e.target.value }))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    >
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('المادة', 'Subject')}
                    </label>
                    <input
                      value={schedForm.subject}
                      onChange={e => setSchedForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder={tx('مثال: نحو، تفسير، فقه', 'e.g. Arabic Grammar, Fiqh')}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('من', 'From')}
                    </label>
                    <input
                      type="time"
                      value={schedForm.start_time}
                      onChange={e => setSchedForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('إلى', 'To')}
                    </label>
                    <input
                      type="time"
                      value={schedForm.end_time}
                      onChange={e => setSchedForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-4 pt-1">
                    <button
                      type="submit"
                      disabled={schedSaving || !schedForm.tutor_id || !schedForm.subject}
                      className="px-6 py-2 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#60736C] text-white font-bold rounded-xl text-xs transition"
                    >
                      {schedSaving ? (tx('جاري الإضافة...', 'Saving...')) : (tx('إضافة الحصة للجدول', 'Add Slot'))}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Timetable grid */}
            <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('مصفوفة الجدول الأسبوعي', 'Weekly Timetable Grid')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-3 bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-bold text-left w-24">
                        {tx('اليوم', 'Day')}
                      </th>
                      {CLASSES.map(c => (
                        <th key={c} className="py-2.5 px-2 bg-[#FBF8F0] border border-[#E8E1D0] text-[#11694A] font-bold text-center">
                          {tx('الصف', 'Class')} {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day}>
                        <td className="py-2 px-3 bg-[#FBF8F0] border border-[#E8E1D0] font-bold text-[#0B3B2E]">
                          {day}
                        </td>
                        {CLASSES.map(cls => (
                          <td key={cls} className="py-1.5 px-2 bg-white border border-[#E8E1D0] align-top min-w-[110px]">
                            {timetableGrid[day]?.[cls]?.map(s => (
                              <div key={s.id} className="mb-1.5 p-2 bg-[#E3F1EA] border border-[#11694A]/20 rounded-lg text-[10px] group relative">
                                <div className="font-bold text-[#0B3B2E] truncate">{s.subject}</div>
                                <div className="text-[#4A5E56] truncate">{s.profiles?.full_name}</div>
                                <div className="text-[#11694A] font-mono tabular-nums">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</div>
                                {!vpMode && (
                                  <button
                                    onClick={() => handleDeleteSchedule(s.id)}
                                    className="absolute top-1 right-1 text-[#991B1B] opacity-0 group-hover:opacity-100 transition text-[10px]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS OVERVIEW TAB ──────────────────────────────────── */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
              {tx('ملخص نتائج الامتحانات', 'Examination Results Ledger')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                    <th className="py-2.5 pr-4">{tx('الطالب', 'Student')}</th>
                    <th className="py-2.5 pr-4">{tx('الصف', 'Class')}</th>
                    <th className="py-2.5 pr-4">{tx('الامتحان', 'Exam')}</th>
                    <th className="py-2.5 pr-4">{tx('المادة', 'Subject')}</th>
                    <th className="py-2.5 pr-4">{tx('الدرجة', 'Marks')}</th>
                    <th className="py-2.5">{tx('التقدير', 'Grade')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D0]">
                  {results.map(r => (
                    <tr key={r.id} className="hover:bg-[#FBF8F0] transition">
                      <td className="py-2.5 pr-4 font-bold text-[#0B3B2E]">{r.profiles?.full_name}</td>
                      <td className="py-2.5 pr-4 text-[#4A5E56]">{tx('الصف', 'Class')} {r.profiles?.class_number}</td>
                      <td className="py-2.5 pr-4 text-[#14201B]">{r.exam_name}</td>
                      <td className="py-2.5 pr-4 text-[#14201B]">{r.subject}</td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-[#11694A] tabular-nums">
                        {r.marks_obtained}/{r.max_marks}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.grade?.startsWith('A') ? 'bg-[#E3F1EA] text-[#11694A]' :
                          r.grade?.startsWith('B') ? 'bg-[#E0F2F1] text-[#0F7C86]' :
                          r.grade?.startsWith('C') ? 'bg-[#F7EDD2] text-[#C29A3A]' :
                          'bg-[#FEE2E2] text-[#B91C1C]'
                        }`}>{r.grade}</span>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#4A5E56]">
                        {tx('لا توجد نتائج مسجلة حتى الآن.', 'No results recorded yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PrincipalDashboard;
