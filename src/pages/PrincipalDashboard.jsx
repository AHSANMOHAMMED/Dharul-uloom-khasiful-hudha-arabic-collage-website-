import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASSES = [1, 2, 3, 4, 5, 6, 7];

const PrincipalDashboard = ({ vpMode = false }) => {
  const { user, logout } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('overview');
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
      ] = await Promise.all([
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
      toast.error('Failed to load dashboard data');
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
      toast.success('Announcement posted!');
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
    toast.info('Announcement deleted');
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
        title: `Leave Request ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
        message: `Your leave (${selectedLeave.start_date} – ${selectedLeave.end_date}) was ${status}. ${leaveNote ? 'Note: ' + leaveNote : ''}`
      });
      toast.success(`Leave ${status}`);
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
      await supabase.from('profiles').update({ is_approved: approve }).eq('id', tutorId);
      await supabase.from('notifications').insert({
        user_id: tutorId,
        title: approve ? 'Account Approved ✅' : 'Account Rejected ❌',
        message: approve
          ? 'Your tutor account has been approved. You can now log in to the portal.'
          : 'Your tutor account registration has not been approved at this time.'
      });
      toast.success(approve ? 'Tutor approved!' : 'Tutor rejected');
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
      toast.success('Schedule entry added!');
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
    toast.info('Schedule entry removed');
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

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',       label: ar ? 'نظرة عامة' : 'Overview',       icon: '📊' },
    { id: 'announcements',  label: ar ? 'الإعلانات' : 'Announcements',   icon: '📢' },
    { id: 'leaves',         label: ar ? 'الإجازات' : 'Leave Requests',   icon: '📋' },
    ...(!vpMode ? [{ id: 'approvals', label: ar ? 'الموافقات' : 'Approvals', icon: '✅' }] : []),
    { id: 'timetable',      label: ar ? 'الجدول الدراسي' : 'Timetable',  icon: '🗓️' },
    { id: 'results',        label: ar ? 'النتائج' : 'Results Overview',  icon: '📝' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 border-t-2 border-r-2 border-emerald-500 rounded-full animate-spin"></div>
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">⚡</div>
          </div>
          <p className="text-gray-400 text-sm font-light tracking-wide">{ar ? 'تحميل لوحة القيادة...' : 'Loading dashboard...'}</p>
        </div>
      </div>
    );
  }

  const timetableGrid = buildTimetableGrid();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <ToastContainer position="top-right" theme="dark" />
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <div className="glass-panel p-8 rounded-[2rem] border border-emerald-500/20 shadow-glass flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-emerald-500/40 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

          <div className="relative z-10 flex items-center gap-6">
            <div className={`hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br ${vpMode ? 'from-blue-600 to-blue-900 shadow-glow-blue' : 'from-emerald-600 to-emerald-900 shadow-glow-emerald'} items-center justify-center`}>
              <span className="text-4xl text-white font-arabic">{vpMode ? 'ن' : 'م'}</span>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${vpMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-glow-blue' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-glow-emerald'}`}>
                {vpMode ? (ar ? 'نائب الناظر' : 'Vice Principal Portal') : (ar ? 'بوابة الناظر' : 'Principal Portal')}
              </span>
              <h1 className={`mt-3 text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r ${vpMode ? 'from-blue-200 to-blue-500' : 'from-emerald-200 to-emerald-500'}`}>
                {ar ? `مرحباً، ${user?.username}` : `Welcome, ${user?.username}`}
              </h1>
              <p className="text-sm text-gray-400 mt-1 font-medium">
                {ar ? 'إدارة شاملة للكلية والطلاب والكوادر التعليمية' : 'Comprehensive college, student & staff management'}
              </p>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-4">
            <Link to="/library" className="px-6 py-3 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-2xl text-sm font-bold transition-all shadow-lg hover:-translate-y-1 flex items-center gap-2">
              <span className="text-xl">📖</span> {ar ? 'المكتبة' : 'Library'}
            </Link>
            <button onClick={logout} className="px-6 py-3 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-2xl text-sm font-bold transition-all shadow-lg hover:-translate-y-1">
              {ar ? 'خروج' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        {/* Tabs */}
        <div className="glass-panel p-2 rounded-2xl flex overflow-x-auto gap-2 relative z-10 hide-scrollbar border border-gray-800/60 shadow-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${vpMode ? 'from-blue-600 to-teal-600 shadow-glow-blue border-blue-400/20' : 'from-emerald-600 to-teal-600 shadow-glow-emerald border-emerald-400/20'} text-white border`
                  : 'bg-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white border border-transparent'
              }`}
            >
              <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[
                { label: ar ? 'الطلاب' : 'Students', value: stats.totalStudents, icon: '🎓', color: 'emerald' },
                { label: ar ? 'المعلمون' : 'Tutors', value: stats.totalTutors, icon: '👨‍🏫', color: 'blue' },
                { label: ar ? 'إجازات معلقة' : 'Pending Leaves', value: stats.pendingLeaves, icon: '📋', color: 'amber' },
                { label: ar ? 'موافقات معلقة' : 'Pending Approvals', value: stats.pendingApprovals, icon: '⏳', color: 'red' },
                { label: ar ? 'رسوم محصلة' : 'Fees Collected', value: `LKR ${stats.monthlyFeeCollected.toLocaleString()}`, icon: '💰', color: 'emerald' },
                { label: ar ? 'متأخرات' : 'Outstanding', value: `LKR ${stats.monthlyFeeOutstanding.toLocaleString()}`, icon: '⚠️', color: 'amber' },
              ].map((stat, i) => (
                <div key={i} className="glass-card rounded-3xl p-6 text-center space-y-3 group hover:border-gray-600 transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-${stat.color}-500/10 text-${stat.color}-400 border border-${stat.color}-500/20 group-hover:scale-110 transition-transform duration-300`}>
                    {stat.icon}
                  </div>
                  <div className="text-xl lg:text-2xl font-extrabold text-white font-mono tracking-tight">{stat.value}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Announcements preview */}
            <div className="glass-card rounded-[2rem] p-8 space-y-6 hover:border-emerald-500/30 transition-all duration-300">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">📢</span>
                {ar ? 'آخر الإعلانات' : 'Recent Announcements'}
              </h3>
              {announcements.slice(0, 3).map(ann => (
                <div key={ann.id} className="p-5 bg-gray-950/40 border border-gray-800/50 rounded-2xl flex gap-4 items-start hover:bg-gray-900/60 transition-colors">
                  {ann.is_pinned ? (
                    <span className="text-amber-400 text-lg mt-1 shadow-glow-amber bg-amber-500/10 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">📌</span>
                  ) : (
                    <span className="text-gray-500 text-lg mt-1 bg-gray-800 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">📣</span>
                  )}
                  <div>
                    <p className="font-bold text-white text-base leading-tight">{ann.title}</p>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed line-clamp-2">{ann.body}</p>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">{ar ? 'لا توجد إعلانات' : 'No announcements yet.'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANNOUNCEMENTS TAB ─────────────────────────────────────── */}
        {activeTab === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Post new */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-xl font-bold text-white">{ar ? 'إنشاء إعلان جديد' : 'Post New Announcement'}</h2>
              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'العنوان' : 'Title'}</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder={ar ? 'عنوان الإعلان' : 'Announcement title...'} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'المحتوى' : 'Body'}</label>
                  <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={4}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    placeholder={ar ? 'محتوى الإعلان...' : 'Announcement body...'} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} className="rounded accent-amber-500" />
                  <span className="text-sm text-gray-300">{ar ? 'تثبيت الإعلان' : 'Pin this announcement'}</span>
                </label>
                <button type="submit" disabled={announceSaving}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                  {announceSaving ? '...' : (ar ? 'نشر الإعلان' : 'Post Announcement')}
                </button>
              </form>
            </div>

            {/* Existing announcements */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">{ar ? 'الإعلانات المنشورة' : 'Published Announcements'}</h2>
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {announcements.map(ann => (
                  <div key={ann.id} className="p-4 bg-gray-950/50 border border-gray-800/60 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{ann.is_pinned && '📌 '}{ann.title}</p>
                        <p className="text-xs text-gray-500">by {ann.profiles?.full_name} · {new Date(ann.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleTogglePin(ann)}
                          className={`px-2 py-1 rounded text-xs font-bold transition ${ann.is_pinned ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:text-amber-400'}`}>
                          📌
                        </button>
                        <button onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 transition">
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
                {announcements.length === 0 && <p className="text-center text-gray-500 text-sm py-8">{ar ? 'لا توجد إعلانات بعد' : 'No announcements yet.'}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── LEAVE REQUESTS TAB ────────────────────────────────────── */}
        {activeTab === 'leaves' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">
                {ar ? `طلبات الإجازات المعلقة (${leaves.length})` : `Pending Leave Requests (${leaves.length})`}
              </h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {leaves.map(lv => (
                  <div key={lv.id}
                    onClick={() => { setSelectedLeave(lv); setLeaveNote(''); }}
                    className={`p-4 bg-gray-950/40 border rounded-xl cursor-pointer transition ${selectedLeave?.id === lv.id ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-gray-800 hover:border-gray-700'}`}>
                    <div className="flex justify-between">
                      <span className="font-bold text-white text-sm">{lv.profiles?.full_name}</span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">Class {lv.profiles?.class_number}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">{lv.start_date} → {lv.end_date}</p>
                    <p className="text-xs text-gray-400 italic mt-1 line-clamp-1">&quot;{lv.reason}&quot;</p>
                  </div>
                ))}
                {leaves.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-sm">{ar ? 'لا توجد طلبات إجازة معلقة' : 'No pending leave requests.'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">{ar ? 'مراجعة الطلب' : 'Review Selected Leave'}</h2>
              {selectedLeave ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-950/50 border border-gray-800 rounded-xl space-y-2">
                    <p className="font-bold text-white">{selectedLeave.profiles?.full_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{selectedLeave.start_date} → {selectedLeave.end_date}</p>
                    <p className="text-sm text-gray-300">{selectedLeave.reason}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'ملاحظة الرد' : 'Response Note (Optional)'}</label>
                    <textarea value={leaveNote} onChange={e => setLeaveNote(e.target.value)} rows={3}
                      className="w-full bg-gray-950 border border-gray-800 text-white text-sm rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder={ar ? 'ملاحظة اختيارية...' : 'Optional note to student...'} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleReviewLeave('approved')} disabled={leaveProcessing}
                      className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                      ✅ {ar ? 'قبول' : 'Approve'}
                    </button>
                    <button onClick={() => handleReviewLeave('rejected')} disabled={leaveProcessing}
                      className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                      ❌ {ar ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-2">👈</div>
                  <p className="text-sm">{ar ? 'اختر طلباً للمراجعة' : 'Select a leave request to review'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TUTOR APPROVALS TAB (Principal only) ──────────────────── */}
        {activeTab === 'approvals' && !vpMode && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-white">
              {ar ? `موافقات المعلمين المعلقة (${pendingTutors.length})` : `Pending Tutor Approvals (${pendingTutors.length})`}
            </h2>
            {pendingTutors.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm">{ar ? 'لا توجد موافقات معلقة' : 'No pending tutor approvals.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingTutors.map(tutor => (
                  <div key={tutor.id} className="bg-gray-950/50 border border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                        {tutor.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{tutor.full_name}</p>
                        <p className="text-xs text-gray-500">{tutor.email}</p>
                      </div>
                    </div>
                    {tutor.phone && <p className="text-xs text-gray-400">📞 {tutor.phone}</p>}
                    <p className="text-xs text-gray-500">{ar ? 'تسجيل' : 'Registered'}: {new Date(tutor.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleTutorApproval(tutor.id, true)} disabled={approving === tutor.id}
                        className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition disabled:bg-gray-800">
                        {ar ? 'قبول' : 'Approve'}
                      </button>
                      <button onClick={() => handleTutorApproval(tutor.id, false)} disabled={approving === tutor.id}
                        className="flex-1 py-2 bg-red-800/60 hover:bg-red-700 text-red-200 font-bold rounded-xl text-xs transition disabled:bg-gray-800">
                        {ar ? 'رفض' : 'Reject'}
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
          <div className="space-y-8">
            {/* Add schedule form (principal only) */}
            {!vpMode && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">{ar ? 'إضافة حصة دراسية' : 'Add Schedule Entry'}</h2>
                <form onSubmit={handleAddSchedule} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'المعلم' : 'Tutor'}</label>
                    <select value={schedForm.tutor_id} onChange={e => setSchedForm(f => ({ ...f, tutor_id: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="">{ar ? 'اختر معلماً' : 'Select tutor...'}</option>
                      {tutorsList.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'الصف' : 'Class'}</label>
                    <select value={schedForm.class_number} onChange={e => setSchedForm(f => ({ ...f, class_number: +e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none">
                      {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'اليوم' : 'Day'}</label>
                    <select value={schedForm.day_of_week} onChange={e => setSchedForm(f => ({ ...f, day_of_week: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none">
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'المادة' : 'Subject'}</label>
                    <input value={schedForm.subject} onChange={e => setSchedForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder={ar ? 'مثال: نحو' : 'e.g. Arabic Grammar'}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'من' : 'From'}</label>
                    <input type="time" value={schedForm.start_time} onChange={e => setSchedForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1">{ar ? 'إلى' : 'To'}</label>
                    <input type="time" value={schedForm.end_time} onChange={e => setSchedForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div className="col-span-4">
                    <button type="submit" disabled={schedSaving || !schedForm.tutor_id || !schedForm.subject}
                      className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                      {schedSaving ? '...' : (ar ? 'إضافة الحصة' : 'Add Entry')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Timetable grid */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">{ar ? 'الجدول الأسبوعي' : 'Weekly Timetable Grid'}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="py-2 px-3 bg-gray-950 border border-gray-800 text-gray-400 font-bold text-left w-24">{ar ? 'اليوم' : 'Day'}</th>
                      {CLASSES.map(c => (
                        <th key={c} className="py-2 px-2 bg-gray-950 border border-gray-800 text-emerald-400 font-bold text-center">
                          {ar ? `صف ${c}` : `Class ${c}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day}>
                        <td className="py-2 px-3 bg-gray-900/40 border border-gray-800 font-bold text-gray-300">{day}</td>
                        {CLASSES.map(cls => (
                          <td key={cls} className="py-1.5 px-2 bg-gray-950/30 border border-gray-800 align-top min-w-[100px]">
                            {timetableGrid[day]?.[cls]?.map(s => (
                              <div key={s.id} className="mb-1 p-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded text-[10px] group relative">
                                <div className="font-bold text-emerald-300 truncate">{s.subject}</div>
                                <div className="text-gray-500 truncate">{s.profiles?.full_name}</div>
                                <div className="text-gray-600 font-mono">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</div>
                                {!vpMode && (
                                  <button onClick={() => handleDeleteSchedule(s.id)}
                                    className="absolute top-0.5 right-0.5 text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-[10px]">✕</button>
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">{ar ? 'ملخص نتائج الامتحانات' : 'Exam Results Overview'}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-800">
                    <th className="py-2 pr-4">{ar ? 'الطالب' : 'Student'}</th>
                    <th className="py-2 pr-4">{ar ? 'الصف' : 'Class'}</th>
                    <th className="py-2 pr-4">{ar ? 'الامتحان' : 'Exam'}</th>
                    <th className="py-2 pr-4">{ar ? 'المادة' : 'Subject'}</th>
                    <th className="py-2 pr-4">{ar ? 'الدرجة' : 'Marks'}</th>
                    <th className="py-2">{ar ? 'التقدير' : 'Grade'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {results.map(r => (
                    <tr key={r.id} className="hover:bg-gray-900/30 transition">
                      <td className="py-2.5 pr-4 font-medium text-white">{r.profiles?.full_name}</td>
                      <td className="py-2.5 pr-4 text-gray-400">Class {r.profiles?.class_number}</td>
                      <td className="py-2.5 pr-4 text-gray-300">{r.exam_name}</td>
                      <td className="py-2.5 pr-4 text-gray-300">{r.subject}</td>
                      <td className="py-2.5 pr-4 font-mono text-amber-400">{r.marks_obtained}/{r.max_marks}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          r.grade?.startsWith('A') ? 'bg-emerald-500/20 text-emerald-400' :
                          r.grade?.startsWith('B') ? 'bg-blue-500/20 text-blue-400' :
                          r.grade?.startsWith('C') ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{r.grade}</span>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-500">{ar ? 'لا توجد نتائج بعد' : 'No results recorded yet.'}</td></tr>
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
