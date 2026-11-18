import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTabParam } from '../lib/useTabParam';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import TutorLmsPanel from '../components/TutorLmsPanel';
import ClassAttendance from '../components/erp/campus/ClassAttendance';
import SelfPayslips from '../components/erp/campus/SelfPayslips';
import { tx } from '../lib/tx';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import { ROLE_BADGE } from '../lib/roleTheme';

const TUTOR_TABS = ['attendance', 'leaves', 'lms', 'salaries'];

const TutorDashboard = () => {
  const { user, isTutor, isEmployee, isTreasurer, loading: authLoading } = useAuth();
  useTranslation();

  const [activeTab, setActiveTab] = useTabParam(TUTOR_TABS, 'attendance');
  const [jobs, setJobs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveReply, setLeaveReply] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveProcessing, setLeaveProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data: jobsData } = await supabase.from('tutor_jobs').select('*').eq('tutor_id', user.id);
        const tutorJobs = jobsData || [];
        if (!alive) return;
        setJobs(tutorJobs);
        const classNums = [...new Set(tutorJobs.map((j) => j.class_number).filter((n) => n != null))];
        const { data: leavesData } = await supabase
          .from('leave_requests')
          .select('*, profiles!leave_requests_student_id_fkey(full_name, class_number)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (!alive) return;
        setLeaves(
          (leavesData || []).filter((lv) =>
            classNums.length === 0 ? false : classNums.includes(lv.profiles?.class_number),
          ),
        );
      } catch (err) {
        console.error('Error fetching tutor details:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const handleReviewLeave = async (status) => {
    if (!selectedLeave) return;
    setLeaveSuccess(false);
    setLeaveProcessing(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, response_note: leaveReply, reviewed_by: user.id })
        .eq('id', selectedLeave.id);
      if (error) throw error;

      const notifyTargets = [selectedLeave.parent_id, selectedLeave.student_id].filter(Boolean);
      if (notifyTargets.length) {
        const { error: notifyErr } = await supabase.from('notifications').insert(
          notifyTargets.map((uid) => ({
            user_id: uid,
            title: `Leave Request ${status.toUpperCase()}`,
            message: `Your leave request for ${selectedLeave.start_date} has been ${status}.${leaveReply ? ` Note: ${leaveReply}` : ''}`,
            link: '/dashboard?tab=leaves',
          })),
        );
        if (notifyErr) {
          console.warn('Leave saved but notification failed', notifyErr);
          toast.warn(tx('تم حفظ القرار لكن تعذر إرسال الإشعار', 'Decision saved but notification could not be sent'));
        }
      }

      setLeaveReply('');
      setSelectedLeave(null);
      setLeaveSuccess(true);
      const classNums = [...new Set(jobs.map((j) => j.class_number).filter((n) => n != null))];
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_student_id_fkey(full_name, class_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setLeaves((leavesData || []).filter((lv) => classNums.includes(lv.profiles?.class_number)));
      setTimeout(() => setLeaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error reviewing leave:', err);
      toast.error(err.message || tx('تعذر تحديث طلب الإجازة', 'Could not update leave request'));
    } finally {
      setLeaveProcessing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="w-12 h-12 rounded-full border-2 border-[#11694A] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isTutor && !isEmployee) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems = [
    { id: 'attendance', label_en: 'Halaqah Attendance', label_ar: 'حضور الحلقات', icon: 'edit_calendar' },
    { id: 'leaves', label_en: 'Leave Requests', label_ar: 'طلبات الإجازة', icon: 'pending_actions', badge: leaves.length },
    { id: 'lms', label_en: 'Coursework & LMS', label_ar: 'إدارة الواجبات', icon: 'assignment' },
    { id: 'salaries', label_en: 'Remuneration Ledger', label_ar: 'بيان الرواتب', icon: 'payments' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#11694A] border-t-transparent animate-spin" />
          <p className="text-sm font-sans text-[#4A5E56]">
            {tx('جاري تحميل لوحة المعلم...', 'Loading tutor dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardSidebarLayout
      title_en="Faculty & Tutor Portal"
      title_ar="بوابة الكادر التعليمي"
      roleBadge={{ text_en: 'Faculty Tutor', text_ar: 'أستاذ ومدرس', color: ROLE_BADGE.emerald }}
      navItems={navItems}
      activeItem={activeTab}
      onSelect={setActiveTab}
    >
      <div className="space-y-8">
        <div id="tutor-khatam" className="hidden" aria-hidden="true" />

        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#11694A]" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                {tx('مرحباً بك، فضيلة الشيخ {name}', 'Welcome, Sheikh {name}').replace('{name}', user?.username || tx('المعلم', 'Tutor'))}
              </h1>
              <p className="text-xs sm:text-sm text-[#4A5E56] font-sans mt-0.5">
                {tx('الحضور عبر ERP، الإجازات، الواجبات، وكشوف الرواتب', 'ERP attendance, leave approvals, coursework & payslips')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isTreasurer && (
                <Link to="/dashboard?view=treasurer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] font-sans font-bold text-xs sm:text-sm rounded-xl transition shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                  <span>{tx('لوحة أمين الصندوق', 'Treasurer Portal')}</span>
                </Link>
              )}
              <Link to="/erp?module=academics" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E3F1EA] hover:bg-[#D4E8DF] border border-[#11694A]/30 text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-[#11694A]">menu_book</span>
                <span>{tx('الشؤون الأكاديمية ERP', 'ERP Academics')}</span>
              </Link>
              <Link to="/erp?module=self" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-[#11694A]">badge</span>
                <span>{tx('مساحتي', 'My workspace')}</span>
              </Link>
            </div>
          </div>
        </div>

        {activeTab === 'attendance' && (
          <div className="erp-theme rounded-2xl border border-[#E8E1D0] bg-white p-4 sm:p-6 shadow-sm">
            {jobs.length > 0 && (
              <p className="text-xs text-[#4A5E56] mb-4">
                {tx('الحلقات المعينة:', 'Assigned classes:')}{' '}
                {[...new Set(jobs.map((j) => j.class_number).filter((n) => n != null))].sort((a, b) => a - b).join(', ') || '—'}
              </p>
            )}
            <ClassAttendance />
          </div>
        )}

        {activeTab === 'salaries' && (
          <div className="erp-theme rounded-2xl border border-[#E8E1D0] bg-white p-4 sm:p-6 shadow-sm">
            <SelfPayslips user={user} />
          </div>
        )}

        {activeTab === 'lms' && <TutorLmsPanel />}

        {activeTab === 'leaves' && (
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">{tx('طلبات الإجازة المعلقة', 'Pending leave requests')}</h2>
            {leaveSuccess && (
              <p className="text-sm text-emerald-700">{tx('تم تحديث الطلب.', 'Request updated.')}</p>
            )}
            {!leaves.length ? (
              <p className="text-sm text-[#4A5E56]">{tx('لا توجد طلبات معلقة لحلقاتك.', 'No pending requests for your classes.')}</p>
            ) : (
              <ul className="space-y-3">
                {leaves.map((lv) => (
                  <li key={lv.id} className="rounded-xl border border-[#E8E1D0] p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#0B3B2E]">{lv.profiles?.full_name || '—'}</p>
                        <p className="text-xs text-[#4A5E56]">
                          {lv.start_date} → {lv.end_date} · {tx('الصف', 'Class')} {lv.profiles?.class_number ?? '—'}
                        </p>
                        {lv.reason ? <p className="text-sm mt-2 text-[#4A5E56]">{lv.reason}</p> : null}
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#11694A]"
                        onClick={() => setSelectedLeave(lv)}
                      >
                        {tx('مراجعة', 'Review')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {selectedLeave && (
              <div className="rounded-xl border border-[#11694A]/30 bg-[#E3F1EA]/40 p-4 space-y-3">
                <p className="font-semibold text-[#0B3B2E]">
                  {tx('مراجعة طلب', 'Review request')}: {selectedLeave.profiles?.full_name}
                </p>
                <textarea
                  className="w-full rounded-lg border border-[#E8E1D0] p-2 text-sm"
                  rows={3}
                  value={leaveReply}
                  onChange={(e) => setLeaveReply(e.target.value)}
                  placeholder={tx('ملاحظة للولي/الطالب (اختياري)', 'Note to parent/student (optional)')}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={leaveProcessing}
                    onClick={() => handleReviewLeave('approved')}
                    className="px-4 py-2 rounded-xl bg-[#11694A] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {tx('موافقة', 'Approve')}
                  </button>
                  <button
                    type="button"
                    disabled={leaveProcessing}
                    onClick={() => handleReviewLeave('rejected')}
                    className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {tx('رفض', 'Reject')}
                  </button>
                  <button type="button" className="px-4 py-2 text-sm text-[#4A5E56]" onClick={() => setSelectedLeave(null)}>
                    {tx('إلغاء', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardSidebarLayout>
  );
};

export default TutorDashboard;
