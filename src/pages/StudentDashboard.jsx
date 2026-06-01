import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [results, setResults] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState(null);
  const [tutorJobs, setTutorJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [querySuccess, setQuerySuccess] = useState(false);

  useEffect(() => {
    fetchStudentData();
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
        setFees(feesData[0]); // Get current month fee
      }

      // 4. Fetch tutor jobs/teachers (for class teacher info)
      const { data: jobsData } = await supabase
        .from('tutor_jobs')
        .select('*, profiles(full_name, phone)')
        .limit(5);
      if (jobsData) setTutorJobs(jobsData);

      // 5. Fetch notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (notifData) setNotifications(notifData);

      // 6. Fetch pinned announcements
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
      // Find class teacher / admin to send message to
      const targetTutor = tutorJobs[0]?.tutor_id;
      if (targetTutor) {
        await supabase.from('notifications').insert({
          user_id: targetTutor,
          title: `Student Query from ${user.username}`,
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

  // Calculate attendance statistics
  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
  const showAttendanceWarning = attendanceRate < 85 && totalDays > 3;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-t-2 border-r-2 border-emerald-500 rounded-full animate-spin"></div>
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">⚡</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-[2rem] glass-card p-10 shadow-2xl border border-emerald-500/20 group perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="relative z-10 md:flex justify-between items-center">
            <div className="flex gap-6 items-center">
              <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 items-center justify-center shadow-glow-emerald">
                <span className="text-4xl text-white font-arabic">ط</span>
              </div>
              <div>
                <span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-glow-amber border border-amber-500/20">
                  {i18n.language === 'ar' ? 'بوابة الطالب' : 'Student Portal'}
                </span>
                <h1 className="mt-4 text-3xl md:text-5xl font-extrabold font-arabic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                  {i18n.language === 'ar' ? `مرحباً بك، ${user?.username}` : `Welcome back, ${user?.username}`}
                </h1>
                <p className="mt-3 text-gray-400 text-sm max-w-xl font-medium">
                  {i18n.language === 'ar' 
                    ? 'رقم القيد الخاص بك: ' 
                    : 'Your Student Index Number: '}
                  <span className="font-mono text-emerald-400 font-bold bg-gray-900 px-2.5 py-1 rounded-lg ml-1 border border-gray-800">
                    {user?.indexNumber}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-8 md:mt-0 flex gap-4">
              <Link 
                to="/library" 
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl transition-all shadow-glow-emerald border border-emerald-400/20 flex items-center gap-3 hover:scale-105"
              >
                <span className="text-xl">📖</span> {i18n.language === 'ar' ? 'المكتبة الرقمية' : 'Digital Library'}
              </Link>
            </div>
          </div>
          {/* Decorative backdrop shapes */}
          <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]"></div>
        </div>

        {/* Pinned Announcements Banner */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id} className="flex items-start gap-3 bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl">
                <span className="text-amber-400 text-lg">📌</span>
                <div>
                  <h3 className="font-bold text-amber-300 text-sm">{ann.title}</h3>
                  <p className="text-xs text-amber-200/70 mt-0.5">{ann.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notifications & Warning Center */}
        {showAttendanceWarning && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 p-4 rounded-xl text-red-200"
          >
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-sm">
                {i18n.language === 'ar' ? 'تنبيه الحضور والمواظبة!' : 'Attendance Alert!'}
              </h3>
              <p className="text-xs text-red-300">
                {i18n.language === 'ar' 
                  ? `نسبة حضورك هي ${attendanceRate}% وهو أقل من الحد المطلوب (85%). يرجى مراجعة المعلم المسؤول.`
                  : `Your attendance is currently ${attendanceRate}%, which is below the required 85%. Please consult your class teacher.`}
              </p>
            </div>
          </motion.div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Attendance Column */}
          <div className="glass-panel rounded-[2rem] p-8 border border-gray-800/60 shadow-glass space-y-6 hover:border-emerald-500/30 transition-colors duration-500">
            <h2 className="text-xl font-bold text-white flex items-center gap-3 font-arabic">
              <span className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">📊</span> 
              {i18n.language === 'ar' ? 'حالة الحضور والغياب' : 'Attendance Status'}
            </h2>
            <div className="flex justify-around items-center py-4 bg-gray-950/40 rounded-xl border border-gray-800/30">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-emerald-400">{attendanceRate}%</div>
                <div className="text-xs text-gray-400 mt-1">{i18n.language === 'ar' ? 'نسبة الحضور' : 'Attendance Rate'}</div>
              </div>
              <div className="h-10 w-[1px] bg-gray-800"></div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-amber-500">{presentDays}</div>
                <div className="text-xs text-gray-400 mt-1">{i18n.language === 'ar' ? 'أيام الحضور' : 'Present Days'}</div>
              </div>
              <div className="h-10 w-[1px] bg-gray-800"></div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-red-400">{absentDays}</div>
                <div className="text-xs text-gray-400 mt-1">{i18n.language === 'ar' ? 'أيام الغياب' : 'Absent Days'}</div>
              </div>
            </div>
            
            {/* Detailed attendance table */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {i18n.language === 'ar' ? 'السجل الأخير' : 'Recent Log'}
              </h3>
              {attendance.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-6">
                  {i18n.language === 'ar' ? 'لا يوجد سجل حضور حالي' : 'No recent attendance logged'}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {attendance.slice(0, 5).map((att) => (
                    <div key={att.id} className="flex justify-between items-center p-2.5 bg-gray-950/20 border border-gray-800/20 rounded-lg text-sm">
                      <span className="font-mono text-gray-300">{new Date(att.date).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        att.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                        att.status === 'late' ? 'bg-amber-500/10 text-amber-400' :
                        att.status === 'excused' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {att.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Academic & Results Column */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic">
              🎓 {i18n.language === 'ar' ? 'نتائج الامتحانات والتقييم' : 'Exam Results & Grades'}
            </h2>
            {results.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <span className="text-4xl block mb-2">📝</span>
                {i18n.language === 'ar' ? 'لم تنشر أي نتائج امتحانات بعد' : 'No results published yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800 text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="py-3 text-left font-semibold">{i18n.language === 'ar' ? 'الامتحان' : 'Exam Name'}</th>
                      <th className="py-3 text-left font-semibold">{i18n.language === 'ar' ? 'المادة' : 'Subject'}</th>
                      <th className="py-3 text-center font-semibold">{i18n.language === 'ar' ? 'الدرجة' : 'Marks'}</th>
                      <th className="py-3 text-center font-semibold">{i18n.language === 'ar' ? 'التقدير' : 'Grade'}</th>
                      <th className="py-3 text-left font-semibold">{i18n.language === 'ar' ? 'ملاحظات المعلم' : 'Remarks'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-gray-300">
                    {results.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-800/10">
                        <td className="py-4 font-semibold text-white">{res.exam_name}</td>
                        <td className="py-4">{res.subject}</td>
                        <td className="py-4 text-center font-mono text-amber-400">
                          {res.marks_obtained} / {res.max_marks}
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {res.grade}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-gray-400 italic">{res.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Tuition Fee Tracker */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic">
              💳 {i18n.language === 'ar' ? 'حالة الرسوم الدراسية' : 'Tuition Monthly Fee'}
            </h2>
            {fees ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-gray-950/40 border border-gray-800 rounded-xl">
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{i18n.language === 'ar' ? 'شهر الفاتورة' : 'Billing Month'}</div>
                    <div className="text-xl font-bold text-white">{fees.month}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                    fees.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    fees.status === 'partial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {i18n.language === 'ar' 
                      ? { completed: 'مكتمل', partial: 'مدفوع جزئياً', unpaid: 'غير مدفوع' }[fees.status]
                      : fees.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-950/20 border border-gray-800/30 rounded-xl text-center">
                    <div className="text-2xl font-black text-amber-500 font-mono">LKR {fees.total_due}</div>
                    <div className="text-xs text-gray-400 mt-1">{i18n.language === 'ar' ? 'المبلغ المستحق' : 'Amount Due'}</div>
                  </div>
                  <div className="p-4 bg-gray-950/20 border border-gray-800/30 rounded-xl text-center">
                    <div className="text-2xl font-black text-emerald-400 font-mono">LKR {fees.paid_amount}</div>
                    <div className="text-xs text-gray-400 mt-1">{i18n.language === 'ar' ? 'المبلغ المدفوع' : 'Amount Paid'}</div>
                  </div>
                </div>

                {/* Arrears Indicator */}
                <div className="flex justify-between items-center p-3 bg-gray-950/10 rounded-lg text-sm border border-gray-800/30">
                  <span className="text-gray-400">{i18n.language === 'ar' ? 'المستحقات المتبقية' : 'Remaining Balance'}</span>
                  <span className="font-mono text-red-400 font-bold">LKR {fees.total_due - fees.paid_amount}</span>
                </div>

                {/* Partial payment history logs */}
                {fees.payments && fees.payments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {i18n.language === 'ar' ? 'دفعات جزئية تاريخية' : 'Partial Payments Log'}
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {fees.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-xs bg-gray-950/40 p-2 rounded border border-gray-800/20">
                          <span className="text-gray-400">{p.date}</span>
                          <span className="font-semibold text-emerald-400">+ LKR {p.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {i18n.language === 'ar' ? 'لا توجد بيانات رسوم لهذا الشهر' : 'No fee statements generated for this month'}
              </div>
            )}
          </div>

          {/* Contact Teacher & Queries */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic">
              💬 {i18n.language === 'ar' ? 'تواصل مع المعلمين' : 'Contact Class Teacher'}
            </h2>
            <div className="space-y-4">
              {tutorJobs.slice(0, 1).map((job) => (
                <div key={job.id} className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex gap-4 items-center">
                  <div className="bg-amber-500 text-gray-950 rounded-full h-12 w-12 flex items-center justify-center font-bold text-lg">
                    👨‍🏫
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{job.profiles?.full_name}</h3>
                    <p className="text-xs text-emerald-400 font-medium">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-1">📞 {job.profiles?.phone || 'No phone provided'}</p>
                  </div>
                </div>
              ))}

              <form onSubmit={handleQuerySubmit} className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {i18n.language === 'ar' ? 'اسأل المعلم أو الإدارة' : 'Ask a Question to Tutor'}
                </label>
                <textarea
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 placeholder-gray-600 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none h-24"
                  placeholder={i18n.language === 'ar' ? 'اكتب استفسارك هنا...' : 'Ask about a homework, subject, or leave request...'}
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 font-bold rounded-lg text-white text-sm transition"
                >
                  {i18n.language === 'ar' ? 'إرسال الاستفسار' : 'Submit Query'}
                </button>
                {querySuccess && (
                  <p className="text-xs text-emerald-400 text-center animate-pulse">
                    ✓ {i18n.language === 'ar' ? 'تم إرسال استفسارك بنجاح.' : 'Query sent successfully.'}
                  </p>
                )}
              </form>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;
