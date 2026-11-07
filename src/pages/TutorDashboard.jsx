import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import TutorLmsPanel from '../components/TutorLmsPanel';
import KhatamPattern from '../components/KhatamPattern';

const TutorDashboard = () => {
  const { user, isTreasurer } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  
  const [jobs, setJobs] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(5); // Default class 5
  
  // Attendance tracking state
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // studentId -> status
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  
  // Leave requests state
  const [leaves, setLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveReply, setLeaveReply] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveProcessing, setLeaveProcessing] = useState(false);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setAttendanceSaving(true);
    
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
      setTimeout(() => setAttendanceSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving attendance records:', err);
    } finally {
      setAttendanceSaving(false);
    }
  };

  // Review & Respond to leave request
  const handleReviewLeave = async (status) => {
    if (!selectedLeave) return;
    setLeaveSuccess(false);
    setLeaveProcessing(true);

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

      setTimeout(() => setLeaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error reviewing leave:', err);
    } finally {
      setLeaveProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#11694A] border-t-transparent animate-spin"></div>
          <p className="text-sm font-sans text-[#4A5E56]">
            {ar ? 'جاري تحميل لوحة المعلم...' : 'Loading tutor dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] relative overflow-hidden py-8 sm:py-12">
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="tutor-khatam" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
        
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0F7C86]"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E0F2F1] text-[#0F7C86] flex items-center justify-center font-arabic text-2xl sm:text-3xl font-bold shrink-0 shadow-sm border border-[#0F7C86]/20">
                م
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0F2F1] text-[#0F7C86] border border-[#0F7C86]/20 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F7C86]"></span>
                  {ar ? 'بوابة المعلمين والأساتذة' : 'Faculty & Tutor Portal'}
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                  {ar ? `مرحباً بك، فضيلة الشيخ ${user?.username || ''}` : `Welcome, Sheikh ${user?.username || 'Tutor'}`}
                </h1>
                <p className="text-xs sm:text-sm text-[#4A5E56] font-sans mt-0.5">
                  {ar ? 'إدارة الحلقات الدراسية، الحضور، الإجازات، والواجبات اليومية' : 'Class halaqah management, attendance logging, leave approvals & assignments'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {isTreasurer && (
                <Link
                  to="/dashboard?treasurer=true"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] font-sans font-bold text-xs sm:text-sm rounded-xl transition shadow-sm"
                >
                  <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {ar ? 'لوحة أمين الصندوق' : 'Treasurer Portal'}
                </Link>
              )}
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm"
              >
                <svg className="w-4 h-4 text-[#11694A] stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {ar ? 'المكتبة الرقمية' : 'Digital Library'}
              </Link>
            </div>
          </div>
        </div>

        {/* Info & Jobs Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Annual Jobs Card */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8E1D0]">
              <div className="w-9 h-9 rounded-xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-base font-serif font-bold text-[#0B3B2E]">
                {ar ? 'المسؤوليات المعينة للعام' : 'Academic Role & Jobs'}
              </h3>
            </div>

            {jobs.length === 0 ? (
              <p className="text-xs text-[#4A5E56] py-3">
                {ar ? 'لا توجد وظائف معينة حالياً للعام الدراسي.' : 'No additional responsibilities assigned for this academic year.'}
              </p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="p-3 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
                    <h4 className="font-sans font-bold text-[#0B3B2E] text-sm">{job.title}</h4>
                    <p className="text-xs text-[#4A5E56] mt-1">{job.description}</p>
                    <span className="inline-block mt-2 text-[10px] bg-[#E3F1EA] text-[#11694A] font-bold px-2 py-0.5 rounded">
                      Year: {job.academic_year || 2026}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Salary card */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8E1D0]">
              <div className="w-9 h-9 rounded-xl bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base font-serif font-bold text-[#0B3B2E]">
                {ar ? 'حالة الراتب الشهري' : 'Salary Statement'}
              </h3>
            </div>

            {salaries.length === 0 ? (
              <p className="text-xs text-[#4A5E56] py-3">
                {ar ? 'لا توجد بيانات مرتبات مدخلة بعد.' : 'No salary records logged yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {salaries.slice(0, 3).map((sal) => (
                  <div key={sal.id} className="flex justify-between items-center p-3 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] text-xs">
                    <div>
                      <span className="text-[10px] text-[#4A5E56] uppercase font-bold tracking-wider">Month</span>
                      <div className="font-bold text-[#0B3B2E]">{sal.month}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#11694A] tabular-nums">LKR {Number(sal.amount).toLocaleString()}</div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                        sal.status === 'paid' ? 'bg-[#E3F1EA] text-[#11694A]' : 'bg-[#FEE2E2] text-[#B91C1C]'
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
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8E1D0]">
              <div className="w-9 h-9 rounded-xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-serif font-bold text-[#0B3B2E]">
                {ar ? 'تحديد الصف والتاريخ' : 'Attendance Session'}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                  {ar ? 'اختر الصف الدراسي' : 'Select Class'}
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(parseInt(e.target.value))}
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-sm text-[#14201B] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>Class {num}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                  {ar ? 'التاريخ' : 'Date'}
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-sm text-[#14201B] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Mark Attendance & Review Leaves */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Mark Attendance Roster */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#E8E1D0]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                  <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                    {ar ? `تسجيل حضور طلاب الصف ${selectedClass}` : `Class ${selectedClass} Attendance Roster`}
                  </h2>
                  <p className="text-xs text-[#4A5E56]">{attendanceDate}</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FBF8F0] text-[#0B3B2E] border border-[#E8E1D0] tabular-nums">
                {students.length} {ar ? 'طالب' : 'Students'}
              </span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12 text-[#4A5E56] text-sm">
                {ar ? 'لا يوجد طلاب مسجلين في هذا الصف.' : 'No approved students found for this class.'}
              </div>
            ) : (
              <form onSubmit={handleSaveAttendance} className="space-y-6">
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {students.map((student) => (
                    <div key={student.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl gap-3">
                      <div>
                        <div className="font-sans font-bold text-[#0B3B2E] text-sm">{student.full_name}</div>
                        <span className="font-mono text-[11px] text-[#4A5E56] tabular-nums">{student.index_number}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 self-end sm:self-auto">
                        {[
                          { key: 'present', label: 'Present', arLabel: 'حاضر', activeBg: 'bg-[#11694A] text-white' },
                          { key: 'absent', label: 'Absent', arLabel: 'غائب', activeBg: 'bg-[#B91C1C] text-white' },
                          { key: 'late', label: 'Late', arLabel: 'متأخر', activeBg: 'bg-[#C29A3A] text-white' },
                          { key: 'excused', label: 'Excused', arLabel: 'معذور', activeBg: 'bg-[#0F7C86] text-white' },
                        ].map((stat) => (
                          <button
                            key={stat.key}
                            type="button"
                            onClick={() => handleAttendanceChange(student.id, stat.key)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                              attendanceRecords[student.id] === stat.key
                                ? stat.activeBg
                                : 'bg-white border border-[#E8E1D0] text-[#4A5E56] hover:text-[#0B3B2E] hover:border-[#0B3B2E]'
                            }`}
                          >
                            {ar ? stat.arLabel : stat.label.substring(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="submit"
                    disabled={attendanceSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#60736C] font-sans font-bold rounded-xl text-white text-sm transition shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    {attendanceSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        {ar ? 'جاري الحفظ...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {ar ? 'حفظ سجل حضور اليوم' : 'Save Attendance Records'}
                      </>
                    )}
                  </button>
                  {attendanceSuccess && (
                    <span className="text-xs text-[#11694A] font-bold animate-pulse">
                      ✓ {ar ? 'تم حفظ سجل الحضور بنجاح!' : 'Attendance records updated successfully!'}
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Manage Leave Requests */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E1D0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                  <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                  {ar ? 'طلبات الإجازات' : 'Leave Requests Queue'}
                </h2>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] tabular-nums">
                {leaves.length}
              </span>
            </div>

            {leaves.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#4A5E56]">
                {ar ? 'لا توجد طلبات إجازة معلقة.' : 'No pending leave requests.'}
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {leaves.map((lv) => (
                  <div
                    key={lv.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 cursor-pointer transition ${
                      selectedLeave?.id === lv.id 
                        ? 'border-[#11694A] bg-[#E3F1EA]/40' 
                        : 'border-[#E8E1D0] bg-[#FBF8F0] hover:border-[#11694A]/40'
                    }`}
                    onClick={() => {
                      setSelectedLeave(lv);
                      setLeaveReply(lv.response_note || '');
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#0B3B2E] text-sm">{lv.profiles?.full_name}</span>
                      <span className="text-[10px] bg-white text-[#4A5E56] border border-[#E8E1D0] px-2 py-0.5 rounded-full">
                        Class {lv.profiles?.class_number}
                      </span>
                    </div>
                    <div className="font-mono text-[#4A5E56] text-[10px] tabular-nums">
                      {lv.start_date} ~ {lv.end_date}
                    </div>
                    <p className="text-[#14201B] italic text-xs">&quot;{lv.reason}&quot;</p>
                  </div>
                ))}
              </div>
            )}

            {/* Selected leave workflow detail */}
            {selectedLeave && (
              <div className="bg-[#FBF8F0] p-4 rounded-xl border border-[#E8E1D0] space-y-3 mt-4">
                <h4 className="font-bold text-xs text-[#0B3B2E] uppercase tracking-wider">
                  {ar ? 'تفاصيل المراجعة والقرار' : `Decision: ${selectedLeave.profiles?.full_name}`}
                </h4>
                <div>
                  <textarea
                    value={leaveReply}
                    onChange={(e) => setLeaveReply(e.target.value)}
                    placeholder={ar ? 'أضف ملاحظة توجيهية للطالب/ولي الأمر...' : 'Optional approval / rejection feedback note...'}
                    className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-[#11694A] resize-none h-16"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewLeave('approved')}
                    disabled={leaveProcessing}
                    className="flex-1 py-2 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-xl text-xs transition"
                  >
                    {ar ? 'قبول الإجازة' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReviewLeave('rejected')}
                    disabled={leaveProcessing}
                    className="flex-1 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-xl text-xs transition"
                  >
                    {ar ? 'رفض الإجازة' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
            {leaveSuccess && (
              <p className="text-xs text-[#11694A] text-center font-bold animate-pulse">
                ✓ {ar ? 'تم تحديث حالة طلب الإجازة!' : 'Leave request processed!'}
              </p>
            )}
          </div>

        </div>

        {/* LMS Module */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)]">
          <TutorLmsPanel />
        </div>

      </div>
    </div>
  );
};

export default TutorDashboard;
