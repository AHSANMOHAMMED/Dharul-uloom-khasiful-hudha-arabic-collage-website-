import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTabParam } from '../lib/useTabParam';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PayFeeButton from '../components/PayFeeButton';
import ReceiptsArrears from '../components/ReceiptsArrears';
import StudentLmsPanel from '../components/StudentLmsPanel';
import PortalTabChrome from '../components/portals/PortalTabChrome';
import KhatamPattern from '../components/KhatamPattern';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import { openChatConversation, sendChatMessage } from '../lib/chatApi';
import { rpc } from '../lib/erp/rpc';
import { tx } from '../lib/tx';

const STUDENT_TABS = ['overview', 'attendance', 'results', 'fees', 'lms', 'query'];

export default function StudentDashboard() {
  const { user } = useAuth();
  useTranslation();
  // Section lives in ?tab= so Back/Forward, refresh and links work.
  const [activeTab, selectTab] = useTabParam(STUDENT_TABS, 'overview');
  const [results, setResults] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [payableFee, setPayableFee] = useState(null);
  const [feeArrearsTotal, setFeeArrearsTotal] = useState(0);
  const [tutorJobs, setTutorJobs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [querySuccess, setQuerySuccess] = useState(false);

  useEffect(() => {
    fetchStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: resultsData } = await supabase
        .from('student_results')
        .select('*, exams(published_at, status, name)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      if (resultsData) {
        setResults(
          resultsData.filter((row) => {
            const exam = row.exams;
            if (!exam) return true;
            return Boolean(exam.published_at) || exam.status === 'published';
          })
        );
      }

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id)
        .order('date', { ascending: false });
      if (attendanceData) setAttendance(attendanceData);

      const arrears = await rpc('student_arrears', { p_student: user.id }).catch(() => null);
      setFeeArrearsTotal(Number(arrears?.total || 0));

      const { data: feesData } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', user.id)
        .order('month', { ascending: false })
        .limit(3);
      const unpaid = (feesData || []).find(
        (f) => f.status !== 'completed' && Number(f.total_due || 0) - Number(f.paid_amount || 0) > 0,
      );
      setPayableFee(unpaid || null);

      if (user.classNumber != null) {
        // Who teaches this student's class (name, phone, subject) — narrow RPC
        // instead of opening the staff directory to students.
        const { data: tutorsData } = await supabase.rpc('my_class_tutors');
        setTutorJobs(
          (tutorsData || []).map((r) => ({
            tutor_id: r.tutor_id,
            title: r.subject,
            profiles: { full_name: r.full_name, phone: r.phone },
          }))
        );
      } else {
        setTutorJobs([]);
      }

      const { data: annData } = await supabase
        .from('announcements')
        .select('id, title, body, is_pinned, created_at')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false })
        .limit(3);
      if (annData) setAnnouncements(annData);
    } catch (error) {
      console.error('Error fetching student dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    try {
      const targetTutor = tutorJobs[0]?.tutor_id;
      if (!targetTutor) {
        toast.error(tx('لا يوجد مشرف معيّن لصفك', 'No tutor is assigned to your class'));
        return;
      }
      // Students cannot insert into notifications (RLS). Use messaging RPCs instead.
      const conversationId = await openChatConversation(targetTutor);
      await sendChatMessage(conversationId, queryText.trim());
      setQueryText('');
      setQuerySuccess(true);
      toast.success(tx('تم إرسال الرسالة للمشرف', 'Message sent to your tutor'));
      setTimeout(() => setQuerySuccess(false), 3000);
    } catch (err) {
      console.error('Error submitting query:', err);
      toast.error(err.message || tx('تعذر إرسال الرسالة', 'Could not send message'));
    }
  };

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
  const showAttendanceWarning = attendanceRate < 85 && totalDays > 3;

  const latestResult = results[0];
  const tutorProfile = tutorJobs[0]?.profiles;

  const navItems = [
    { id: 'overview', label_en: 'Academic Overview', label_ar: 'نظرة عامة', icon: 'dashboard' },
    { id: 'attendance', label_en: 'Halaqah Attendance', label_ar: 'سجل الحضور', icon: 'event_available' },
    { id: 'results', label_en: 'Assessment Marks', label_ar: 'الدرجات والتقييم', icon: 'grade', badge: results.length },
    {
      id: 'fees',
      label_en: 'Tuition Ledger',
      label_ar: 'الرسوم والإيصالات',
      icon: 'payments',
      badge: feeArrearsTotal > 0 ? 1 : 0,
      badgeTone: feeArrearsTotal > 0 ? 'danger' : 'emerald',
    },
    { id: 'lms', label_en: 'Coursework LMS', label_ar: 'الواجبات والتكليفات', icon: 'assignment' },
    { id: 'query', label_en: 'Message Tutor', label_ar: 'مراسلة المشرف', icon: 'help_center' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50 text-ink-text-primary">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const resultsTable = (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-sand-border bg-parchment-50 text-ink-text-secondary uppercase text-[10px] tracking-wider">
            <th className="py-2.5 px-3">{tx('المادة', 'Subject / Discipline')}</th>
            <th className="py-2.5 px-3">{tx('الفصل', 'Exam Term')}</th>
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
                <span className="px-2 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 font-semibold text-[11px]">{r.grade || 'Pass'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DashboardSidebarLayout
      title_en="Student Portal"
      title_ar="بوابة الطالب الأكاديمية"
      roleBadge={{
        text_en: user?.indexNumber ? `Index ${user.indexNumber}` : 'Scholar Student',
        text_ar: user?.indexNumber ? `رقم القيد ${user.indexNumber}` : 'طالب علم',
        color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20',
      }}
      navItems={navItems}
      activeItem={activeTab}
      onSelect={selectTab}
    >
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <div className="rounded-[14px] bg-ink-green-900 text-paper-white p-6 sm:p-8 shadow-manuscript-md border border-sand-border/20 relative overflow-hidden">
            <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="student-header-khatam" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-700/80 text-white text-[11px] font-semibold uppercase tracking-wider">
                    {tx('بوابة الطالب الأكاديمية', 'Student Portal Desk')}
                  </span>
                  {user?.indexNumber && (
                    <span className="font-mono text-xs bg-paper-white/10 px-2.5 py-0.5 rounded border border-sand-border/20 text-gold-wash-100">{user.indexNumber}</span>
                  )}
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-paper-white">
                  {tx(`السلام عليكم ورحمة الله، ${user?.username}`, `Assalamu Alaikum, ${user?.username}`)}
                </h1>
                <p className="text-xs sm:text-sm text-dark-text-primary/75 max-w-xl font-sans">
                  {tx(
                    'متابعة الحضور اليومي في الحلقات، كشف الدرجات، حالة الرسوم والواجبات المدرسية المفتوحة.',
                    'Review your daily halaqah presence, term marksheet, tuition status, and open assignment submissions.'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link to="/library" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-paper-white/10 hover:bg-paper-white/20 text-white text-xs font-semibold border border-sand-border/20 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                  <span>{tx('المكتبة الرقمية', 'Open Library')}</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl bg-gold-wash-100/60 border border-brass-gold-500/30 flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-brass-gold-500 text-[18px] shrink-0 mt-0.5">{'campaign'}</span>
                <div>
                  <h4 className="font-serif font-bold text-ink-green-900">{ann.title}</h4>
                  <p className="text-ink-text-secondary mt-0.5">{ann.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && showAttendanceWarning && (
          <div className="p-4 rounded-xl bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger flex items-start gap-3 text-xs">
            <span className="material-symbols-outlined text-xl shrink-0">{'warning'}</span>
            <div>
              <h4 className="font-semibold">{tx('تنبيه الحضور: النسبة دون الحد المطلوب', 'Attendance Warning: Ratio Below Threshold')}</h4>
              <p className="mt-0.5">
                {tx(
                  `نسبة حضورك حالياً هي ${attendanceRate}% (الحد الأدنى المطلوب 85%). يرجى مراجعة مشرف الحلقة.`,
                  `Your presence rate is currently ${attendanceRate}% (minimum institutional threshold is 85%). Please consult your Halaqah supervisor.`
                )}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
              <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">{tx('حضور الحلقات', 'Halaqah Attendance')}</span>
              <span className="font-serif text-3xl font-bold text-emerald-700 tabular-nums">{attendanceRate}%</span>
              <span className="text-[11px] text-ink-text-muted block mt-1">
                {presentDays} {tx('من أصل', 'of')} {totalDays} {tx('جلسات مسجلة', 'recorded sessions')}
              </span>
            </div>
            <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
              <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">{tx('الرسوم المستحقة', 'Outstanding Fees')}</span>
              <span className="font-serif text-3xl font-bold text-brass-gold-500 tabular-nums">{`LKR ${feeArrearsTotal.toLocaleString()}`}</span>
              <span className="text-[11px] text-ink-text-muted block mt-1">{feeArrearsTotal > 0 ? tx('حسب سجل ERP', 'Per ERP ledger') : tx('لا توجد متأخرات نشطة', 'No active arrears')}</span>
            </div>
            <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
              <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">{tx('آخر تقدير دراسي', 'Latest Term Grade')}</span>
              <span className="font-serif text-3xl font-bold text-ink-green-900">{latestResult?.grade || '—'}</span>
              <span className="text-[11px] text-ink-text-muted block mt-1">{latestResult?.exam_name || tx('لا درجات منشورة بعد', 'No published marks yet')}</span>
            </div>
            <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
              <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">{tx('مشرف الفصل', 'Class Tutor')}</span>
              <span className="font-serif text-lg font-bold text-ink-green-900 truncate block">{tutorProfile?.full_name || tx('لا يوجد مشرف معيّن', 'No tutor assigned')}</span>
              <span className="text-[11px] text-ink-text-muted block mt-1">{tx('سجلات منصة الحلقات', 'From halaqah assignments')}</span>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
            <h3 className="font-serif text-lg font-semibold text-ink-green-900">{tx('أحدث الدرجات', 'Recent Examination Marks')}</h3>
            {results.length === 0 ? (
              <p className="text-xs text-ink-text-muted py-4 text-center">{tx('لم تُنشر أي درجات لهذا الفصل حتى الآن.', 'No examination records published for this academic term yet.')}</p>
            ) : (
              resultsTable
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <PortalTabChrome title_en="Halaqah Attendance" title_ar="سجل الحضور" onBack={() => selectTab('overview')} onPrint={() => window.print()}>
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
              {attendance.length === 0 ? (
                <p className="text-xs text-ink-text-muted text-center py-8">{tx('لا توجد سجلات حضور بعد.', 'No attendance records yet.')}</p>
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
                        <tr key={a.id || `${a.date}-${a.status}`}>
                          <td className="py-2.5 px-3 font-mono">{a.date}</td>
                          <td className="py-2.5 px-3 capitalize">{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </PortalTabChrome>
        )}

        {activeTab === 'results' && (
          <PortalTabChrome title_en="Assessment Marks" title_ar="الدرجات والتقييم" onBack={() => selectTab('overview')}>
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
              {results.length === 0 ? (
                <p className="text-xs text-ink-text-muted py-6 text-center">{tx('لم تُنشر أي درجات لهذا الفصل حتى الآن.', 'No examination records published for this academic term yet.')}</p>
              ) : (
                resultsTable
              )}
            </div>
          </PortalTabChrome>
        )}

        {activeTab === 'fees' && (
          <PortalTabChrome title_en="Tuition Ledger" title_ar="الرسوم والإيصالات" onBack={() => selectTab('overview')}>
            <div className="space-y-6">
              <ReceiptsArrears studentId={user?.id} />
              {payableFee && (
                <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
                  <PayFeeButton fee={payableFee} />
                </div>
              )}
            </div>
          </PortalTabChrome>
        )}

        {activeTab === 'lms' && (
          <PortalTabChrome title_en="Coursework LMS" title_ar="الواجبات والتكليفات" onBack={() => selectTab('overview')}>
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
              <StudentLmsPanel />
            </div>
          </PortalTabChrome>
        )}

        {activeTab === 'query' && (
          <PortalTabChrome title_en="Message Class Tutor" title_ar="مراسلة المشرف" onBack={() => selectTab('overview')}>
            <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-3">
              <p className="text-xs text-ink-text-muted">
                {tutorProfile?.full_name
                  ? `${tx('إلى:', 'To:')} ${tutorProfile.full_name}`
                  : tx('لا يوجد مشرف معيّن لصفك حالياً.', 'No tutor is assigned to your class yet.')}
              </p>
              {querySuccess && <p className="text-xs text-emerald-700 font-semibold">{tx('تم إرسال الرسالة للمشرف.', 'Message dispatched to tutor.')}</p>}
              <form onSubmit={handleQuerySubmit} className="space-y-2">
                <textarea
                  rows={3}
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  disabled={!tutorJobs[0]?.tutor_id}
                  placeholder={tx('اسأل بخصوص الواجبات أو الدروس...', 'Ask a question regarding assignments or lessons...')}
                  className="w-full p-2.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs disabled:opacity-50"
                />
                <button type="submit" disabled={!tutorJobs[0]?.tutor_id} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50">
                  {tx('إرسال الاستفسار', 'Send Query')}
                </button>
              </form>
            </div>
          </PortalTabChrome>
        )}
      </div>
    </DashboardSidebarLayout>
  );
}
