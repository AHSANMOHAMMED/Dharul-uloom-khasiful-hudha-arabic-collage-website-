import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PayFeeButton from '../components/PayFeeButton';
import ReceiptsArrears from '../components/ReceiptsArrears';
import StudentLmsPanel from '../components/StudentLmsPanel';
import { generateFeeReceipt } from '../lib/exportUtils';
import KhatamPattern from '../components/KhatamPattern';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import { tx } from '../lib/tx';

export default function StudentDashboard() {
  const { user } = useAuth();
  useTranslation();

  const [activeTab, setActiveTab] = useState('overview');
  const [results, setResults] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState(null);
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
      
      // 1. Fetch results
      const { data: resultsData } = await supabase
        .from('student_results')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      if (resultsData) setResults(resultsData);

      // 2. Fetch attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id)
        .order('date', { ascending: false });
      if (attendanceData) setAttendance(attendanceData);

      // 3. Fetch fees
      const { data: feesData } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', user.id)
        .order('month', { ascending: false });
      if (feesData && feesData.length > 0) {
        setFees(feesData[0]);
      }

      // 4. Fetch tutor jobs/teachers
      const { data: jobsData } = await supabase
        .from('tutor_jobs')
        .select('*, profiles(full_name, phone)')
        .limit(5);
      if (jobsData) setTutorJobs(jobsData);

      // 5. Fetch pinned announcements
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
      if (targetTutor) {
        await supabase.from('notifications').insert({
          user_id: targetTutor,
          title: `Student Inquiry from ${user.username}`,
          message: queryText
        });
      }
      setQueryText('');
      setQuerySuccess(true);
      setTimeout(() => setQuerySuccess(false), 3000);
    } catch (err) {
      console.error('Error submitting query:', err);
    }
  };

  // Calculations
  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
  const showAttendanceWarning = attendanceRate < 85 && totalDays > 3;

  const latestResult = results[0];
  const totalDue = fees ? Math.max(0, (fees.total_due || 0) - (fees.paid_amount || 0)) : 0;

  const navItems = [
    { id: 'overview', label_en: 'Academic Overview', label_ar: 'نظرة عامة', icon: 'dashboard' },
    { id: 'results', label_en: 'Assessment Marks', label_ar: 'الدرجات والتقييم', icon: 'grade', badge: results.length },
    { id: 'fees', label_en: 'Tuition Ledger', label_ar: 'الرسوم والإيصالات', icon: 'payments', badge: totalDue > 0 ? 1 : 0, badgeTone: totalDue > 0 ? 'danger' : 'emerald' },
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

  return (
    <DashboardSidebarLayout
      title_en="Student Portal"
      title_ar="بوابة الطالب الأكاديمية"
      roleBadge={{
        text_en: user?.indexNumber ? `Index ${user.indexNumber}` : 'Scholar Student',
        text_ar: user?.indexNumber ? `رقم القيد ${user.indexNumber}` : 'طالب علم',
        color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20'
      }}
      navItems={navItems}
      activeItem={activeTab}
      onSelect={setActiveTab}
    >
      <div className="space-y-8">
        
        {/* 1. Header Banner */}
        <div className="rounded-[14px] bg-ink-green-900 text-paper-white p-6 sm:p-8 shadow-manuscript-md border border-sand-border/20 relative overflow-hidden">
          <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="student-header-khatam" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-700/80 text-white text-[11px] font-semibold uppercase tracking-wider">
                  {tx('بوابة الطالب الأكاديمية', 'Student Portal Desk')}
                </span>
                {user?.indexNumber && (
                  <span className="font-mono text-xs bg-paper-white/10 px-2.5 py-0.5 rounded border border-sand-border/20 text-gold-wash-100">
                    {user.indexNumber}
                  </span>
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
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-paper-white/10 hover:bg-paper-white/20 text-white text-xs font-semibold border border-sand-border/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                <span>{tx('المكتبة الرقمية', 'Open Library')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Pinned Announcements & Attendance Warning */}
        {announcements.length > 0 && (
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

        {showAttendanceWarning && (
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

        {/* 3. Four KPI Stat Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
            <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
              {tx('حضور الحلقات', 'Halaqah Attendance')}
            </span>
            <span className="font-serif text-3xl font-bold text-emerald-700 tabular-nums">
              {attendanceRate}%
            </span>
            <span className="text-[11px] text-ink-text-muted block mt-1">
              {presentDays} {tx('من أصل', 'of')} {totalDays} {tx('جلسات مسجلة', 'recorded sessions')}
            </span>
          </div>

          <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
            <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
              {tx('الرسوم المستحقة', 'Outstanding Fees')}
            </span>
            <span className="font-serif text-3xl font-bold text-brass-gold-500 tabular-nums">
              {`LKR ${totalDue.toLocaleString()}`}
            </span>
            <span className="text-[11px] text-ink-text-muted block mt-1">
              {fees?.month ? `${tx('الحالي:', 'Current:')} ${fees.month}` : tx('لا توجد متأخرات نشطة', 'No active arrears')}
            </span>
          </div>

          <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
            <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
              {tx('آخر تقدير دراسي', 'Latest Term Grade')}
            </span>
            <span className="font-serif text-3xl font-bold text-ink-green-900">
              {latestResult?.grade || 'A-'}
            </span>
            <span className="text-[11px] text-ink-text-muted block mt-1">
              {latestResult?.exam_name || tx('التقييم النصفي', 'Mid-Term Appraisal')}
            </span>
          </div>

          <div className="p-5 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
            <span className="text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider block mb-1">
              {tx('الحالة الأكاديمية', 'Academic Status')}
            </span>
            <span className="font-serif text-2xl font-bold text-emerald-700">
              {tx('منتظم ومستقر', 'Good Standing')}
            </span>
            <span className="text-[11px] text-ink-text-muted block mt-1">
              {tx('طالب داخلي مقيم', 'Full Residential Scholar')}
            </span>
          </div>
        </div>

        {/* 4. Main Grid: Results Table & Fee Clearance */}
        {(activeTab === 'overview' || activeTab === 'results' || activeTab === 'fees' || activeTab === 'query') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Exam Results Table */}
            {(activeTab === 'overview' || activeTab === 'results') && (
              <div className={`${activeTab === 'results' ? 'lg:col-span-12' : 'lg:col-span-7'} rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4`}>
                <div className="flex items-center justify-between pb-3 border-b border-sand-border">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
                      {tx('سجل التقييم', 'Assessment Ledger')}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                      {tx('درجات الاختبارات الأخيرة', 'Recent Examination Marks')}
                    </h3>
                  </div>
                </div>

                {results.length === 0 ? (
                  <p className="text-xs text-ink-text-muted py-6 text-center">
                    {tx('لم تُنشر أي درجات لهذا الفصل حتى الآن.', 'No examination records published for this academic term yet.')}
                  </p>
                ) : (
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
                            <td className="py-2.5 px-3 font-medium text-ink-text-primary">
                              {r.subject}
                            </td>
                            <td className="py-2.5 px-3 text-ink-text-muted">
                              {r.exam_name}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-ink-green-900 tabular-nums">
                              {r.marks ?? '-'}
                            </td>
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
            )}

            {/* Tuition Fee Clearance Card & Receipts */}
            {(activeTab === 'overview' || activeTab === 'fees' || activeTab === 'query') && (
              <div className={`${activeTab === 'overview' ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-6`}>
                {(activeTab === 'overview' || activeTab === 'fees') && (
                  <>
                    <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-4">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-brass-gold-500 block">
                        {tx('الصندوق المالي', 'Tuition Ledger')}
                      </span>
                      <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                        {tx('كشف وبراءة الرسوم', 'Fee Statement & Clearance')}
                      </h3>

                      {fees ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border text-xs space-y-2">
                            <div className="flex justify-between">
                              <span className="text-ink-text-muted">{tx('شهر الفاتورة:', 'Billing Cycle:')}</span>
                              <span className="font-semibold text-ink-green-900">{fees.month}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ink-text-muted">{tx('إجمالي الرسوم:', 'Total Due:')}</span>
                              <span className="font-mono tabular-nums text-ink-text-primary">{`LKR ${fees.total_due ?? fees.amount}`}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ink-text-muted">{tx('المدفوع:', 'Amount Paid:')}</span>
                              <span className="font-mono tabular-nums text-emerald-700 font-semibold">{`LKR ${fees.paid_amount || 0}`}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-sand-border">
                              <span className="font-semibold text-ink-text-primary">{tx('المتبقي:', 'Outstanding Balance:')}</span>
                              <span className="font-mono tabular-nums text-brass-gold-500 font-bold text-sm">
                                {`LKR ${Math.max(0, (fees.total_due ?? fees.amount ?? 0) - (fees.paid_amount || 0))}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {totalDue > 0 ? (
                              <div className="flex-1">
                                <PayFeeButton fee={fees} />
                              </div>
                            ) : (
                              <div className="flex-1 p-2.5 rounded-lg bg-mint-wash-100 text-emerald-700 text-center text-xs font-semibold">
                                {tx('تمت التسوية كاملة', 'Account Settled · Zero Dues')}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => generateFeeReceipt(
                                { full_name: user?.username, index_number: user?.indexNumber, class_number: user?.classNumber },
                                fees,
                                'Online Portal'
                              )}
                              title={tx('طباعة إيصال الكلية (A5)', 'Print A5 College Receipt')}
                              className="h-10 px-3.5 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-secondary text-xs flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">receipt</span>
                              <span>{tx('إيصال', 'Receipt')}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 rounded-xl bg-parchment-50 border border-sand-border text-center text-xs text-ink-text-muted">
                          {tx('لا توجد مستحقات رسوم مسجلة حالياً.', 'No outstanding tuition records on file.')}
                        </div>
                      )}
                    </div>

                    {/* ERP Receipts & Arrears */}
                    <ReceiptsArrears studentId={user?.id} />
                  </>
                )}

                {/* Quick Contact Teacher Form */}
                {(activeTab === 'overview' || activeTab === 'query') && (
                  <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript space-y-3">
                    <h4 className="font-serif text-sm font-semibold text-ink-green-900">
                      {tx('مراسلة مشرف الفصل', 'Message Class Tutor')}
                    </h4>
                    {querySuccess && (
                      <p className="text-xs text-emerald-700 font-semibold">{tx('تم إرسال الرسالة للمشرف.', 'Message dispatched to tutor.')}</p>
                    )}
                    <form onSubmit={handleQuerySubmit} className="space-y-2">
                      <textarea
                        rows={2}
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        placeholder={tx('اسأل بخصوص الواجبات أو الدروس...', 'Ask a question regarding assignments or lessons...')}
                        className="w-full p-2.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        {tx('إرسال الاستفسار', 'Send Query')}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* 5. LMS Panel Integration */}
        {(activeTab === 'overview' || activeTab === 'lms') && (
          <div className="rounded-[14px] bg-paper-white border border-sand-border p-6 shadow-manuscript">
            <StudentLmsPanel />
          </div>
        )}

      </div>
    </DashboardSidebarLayout>
  );
}
