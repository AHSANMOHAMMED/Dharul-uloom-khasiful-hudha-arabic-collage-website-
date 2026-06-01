import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

const TutorDashboard = () => {
  const { user, isTreasurer } = useAuth();
  const { i18n } = useTranslation();
  
  const [jobs, setJobs] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(5); // Default class 5
  
  // Attendance tracking state
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // studentId -> status
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  
  // Leave requests state
  const [leaves, setLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveReply, setLeaveReply] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutorData();
  }, [user]);

  useEffect(() => {
    fetchClassStudents(selectedClass);
  }, [selectedClass]);

  const fetchTutorData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch assigned jobs
      const { data: jobsData } = await supabase
        .from('tutor_jobs')
        .select('*')
        .eq('tutor_id', user.id);
      setJobs(jobsData || []);

      // 2. Fetch salaries log
      const { data: salariesData } = await supabase
        .from('tutor_salaries')
        .select('*')
        .eq('tutor_id', user.id)
        .order('month', { ascending: false });
      setSalaries(salariesData || []);

      // 3. Fetch pending leave requests
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_student_id_fkey(full_name, class_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setLeaves(leavesData || []);

    } catch (err) {
      console.error('Error fetching tutor details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch student roster for a class number
  const fetchClassStudents = async (classNum) => {
    try {
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, index_number')
        .eq('account_type', 'student')
        .eq('class_number', classNum)
        .eq('is_approved', true)
        .order('full_name', { ascending: true });

      setStudents(studentsData || []);
      
      // Initialize attendance values
      const initialRecords = {};
      studentsData?.forEach(s => {
        initialRecords[s.id] = 'present';
      });
      setAttendanceRecords(initialRecords);
    } catch (err) {
      console.error('Error fetching class students:', err);
    }
  };

  const handleAttendanceChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Save Attendance to database
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    setAttendanceSuccess(false);
    
    try {
      const rows = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: studentId,
        date: attendanceDate,
        status: status,
        marked_by: user.id
      }));

      // Insert or update attendance idempotently
      for (const row of rows) {
        await supabase
          .from('attendance')
          .upsert(row, { onConflict: 'student_id, date' });
      }

      setAttendanceSuccess(true);
      setTimeout(() => setAttendanceSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving attendance records:', err);
    }
  };

  // Review & Respond to leave request
  const handleReviewLeave = async (status) => {
    if (!selectedLeave) return;
    setLeaveSuccess(false);

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: status,
          response_note: leaveReply,
          reviewed_by: user.id
        })
        .eq('id', selectedLeave.id);

      if (error) throw error;

      // Send notification to student / parent
      await supabase.from('notifications').insert([
        {
          user_id: selectedLeave.student_id,
          title: `Leave Request ${status.toUpperCase()}`,
          message: `Your leave request for ${selectedLeave.start_date} has been ${status}.`
        }
      ]);

      setLeaveReply('');
      setSelectedLeave(null);
      setLeaveSuccess(true);
      
      // Refresh leaves list
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_student_id_fkey(full_name, class_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setLeaves(leavesData || []);

      setTimeout(() => setLeaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error reviewing leave:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-t-2 border-r-2 border-amber-500 rounded-full animate-spin"></div>
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400">⚡</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Dashboard Header */}
        <div className="glass-panel p-8 rounded-[2rem] border border-amber-500/20 shadow-glass flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-amber-500/40 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="relative z-10 flex items-center gap-6">
             <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 items-center justify-center shadow-glow-amber">
                <span className="text-4xl text-white font-arabic">م</span>
              </div>
            <div>
              <span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-glow-amber border border-amber-500/20">
                {i18n.language === 'ar' ? 'بوابة المعلمين' : 'Tutor Portal'}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                {i18n.language === 'ar' ? `مرحباً بك، فضيلة الشيخ ${user?.username}` : `Welcome back, Sheikh ${user?.username}`}
              </h1>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4">
            {isTreasurer && (
              <Link
                to="/dashboard?treasurer=true"
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black rounded-2xl transition-all shadow-glow-amber hover:-translate-y-1 flex items-center gap-2"
              >
                <span className="text-xl">💰</span> {i18n.language === 'ar' ? 'لوحة أمين الصندوق' : 'Treasurer Panel'}
              </Link>
            )}
            <Link
              to="/library"
              className="px-6 py-3 bg-gray-900/80 border border-gray-700 text-gray-200 rounded-2xl hover:bg-gray-800 transition-all shadow-lg hover:-translate-y-1 flex items-center gap-2"
            >
              <span className="text-xl">📖</span> {i18n.language === 'ar' ? 'المكتبة الرقمية' : 'Digital Library'}
            </Link>
          </div>
        </div>

        {/* Info & Jobs Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Annual Jobs Card */}
          <div className="glass-card rounded-[2rem] p-8 space-y-6 hover:border-emerald-500/30 transition-all duration-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">💼</span>
              {i18n.language === 'ar' ? 'المسؤوليات المعينة للعام' : 'Academic Job / Role'}
            </h3>
            {jobs.length === 0 ? (
              <p className="text-xs text-gray-500">
                {i18n.language === 'ar' ? 'لا توجد وظائف معينة حالياً للعام الدراسي' : 'No jobs or responsibilities assigned for this year.'}
              </p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                    <h4 className="font-bold text-white text-sm">{job.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">{job.description}</p>
                    <span className="inline-block mt-2 text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded uppercase">
                      Year: {job.academic_year}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Salary card */}
          <div className="glass-card rounded-[2rem] p-8 space-y-6 hover:border-amber-500/30 transition-all duration-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">💵</span>
              {i18n.language === 'ar' ? 'حالة الراتب الشهري' : 'Salary Statement'}
            </h3>
            {salaries.length === 0 ? (
              <p className="text-xs text-gray-500">
                {i18n.language === 'ar' ? 'لا توجد بيانات مرتبات مدخلة' : 'No salary histories recorded.'}
              </p>
            ) : (
              <div className="space-y-3">
                {salaries.slice(0, 3).map((sal) => (
                  <div key={sal.id} className="flex justify-between items-center p-3 bg-gray-950/40 rounded-xl border border-gray-800/30 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase">Month</span>
                      <div className="font-bold text-white">{sal.month}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-400 font-mono">LKR {sal.amount}</div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        sal.status === 'paid' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-red-500/25 text-red-400'
                      }`}>
                        {sal.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance controller header */}
          <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              ⚙️ {i18n.language === 'ar' ? 'الفصل الدراسي النشط' : 'Attendance Configuration'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'اختر الصف' : 'Select Class'}</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(parseInt(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>Class {num}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'التاريخ' : 'Date'}</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2 focus:outline-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Mark Attendance & Review Leaves */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Mark Attendance Roster */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic">
                📝 {i18n.language === 'ar' ? 'تسجيل حضور طلاب الصف' : `Class ${selectedClass} Student Attendance`}
              </h2>
              <span className="text-xs text-gray-400">Total: {students.length} Students</span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                {i18n.language === 'ar' ? 'لا يوجد طلاب مسجلين في هذا الصف' : 'No approved students found for this class.'}
              </div>
            ) : (
              <form onSubmit={handleSaveAttendance} className="space-y-6">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {students.map((student) => (
                    <div key={student.id} className="flex justify-between items-center p-3 bg-gray-950/20 border border-gray-800/40 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-sm">{student.full_name}</div>
                        <span className="font-mono text-[10px] text-gray-500">{student.index_number}</span>
                      </div>
                      <div className="flex gap-2">
                        {['present', 'absent', 'late', 'excused'].map((stat) => (
                          <button
                            key={stat}
                            type="button"
                            onClick={() => handleAttendanceChange(student.id, stat)}
                            className={`px-2.5 py-1 rounded text-xs font-bold uppercase transition ${
                              attendanceRecords[student.id] === stat
                                ? stat === 'present' ? 'bg-emerald-500 text-gray-950' :
                                  stat === 'absent' ? 'bg-red-500 text-gray-950' :
                                  stat === 'late' ? 'bg-amber-500 text-gray-950' :
                                  'bg-blue-500 text-white'
                                : 'bg-gray-850 text-gray-500 hover:text-white'
                            }`}
                          >
                            {stat.substring(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 font-bold rounded-xl text-white text-sm transition"
                >
                  {i18n.language === 'ar' ? 'حفظ سجل حضور اليوم' : 'Save Attendance Records'}
                </button>
                {attendanceSuccess && (
                  <p className="text-sm text-emerald-400 text-center animate-pulse">✓ Attendance saved successfully!</p>
                )}
              </form>
            )}
          </div>

          {/* Manage Leave Requests */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic border-b border-gray-800 pb-4">
              📝 {i18n.language === 'ar' ? 'طلبات الإجازات الواردة' : 'Leave Requests Queue'}
            </h2>
            {leaves.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {i18n.language === 'ar' ? 'لا توجد طلبات إجازة معلقة' : 'No pending leave requests.'}
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {leaves.map((lv) => (
                  <div
                    key={lv.id}
                    className={`p-3 bg-gray-950/40 border border-gray-800 rounded-xl text-xs space-y-2 cursor-pointer transition ${
                      selectedLeave?.id === lv.id ? 'ring-1 ring-amber-500 bg-gray-950/80' : ''
                    }`}
                    onClick={() => {
                      setSelectedLeave(lv);
                      setLeaveReply(lv.response_note || '');
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{lv.profiles?.full_name}</span>
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        Class {lv.profiles?.class_number}
                      </span>
                    </div>
                    <div className="font-mono text-gray-400 text-[10px]">{lv.start_date} ~ {lv.end_date}</div>
                    <p className="text-gray-300 italic">" {lv.reason} "</p>
                  </div>
                ))}
              </div>
            )}

            {/* Selected leave workflow detail */}
            {selectedLeave && (
              <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800 space-y-3 mt-4">
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                  {i18n.language === 'ar' ? 'تفاصيل المراجعة والقرار' : 'Review & Respond'}
                </h4>
                <div>
                  <textarea
                    value={leaveReply}
                    onChange={(e) => setLeaveReply(e.target.value)}
                    placeholder="Approve/Reject reason note..."
                    className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none h-16"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewLeave('approved')}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition"
                  >
                    {i18n.language === 'ar' ? 'قبول الإجازة' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReviewLeave('rejected')}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition"
                  >
                    {i18n.language === 'ar' ? 'رفض الإجازة' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
            {leaveSuccess && <p className="text-xs text-emerald-400 text-center animate-pulse">✓ Leave processed!</p>}
          </div>

        </div>

      </div>
    </div>
  );
};

export default TutorDashboard;
