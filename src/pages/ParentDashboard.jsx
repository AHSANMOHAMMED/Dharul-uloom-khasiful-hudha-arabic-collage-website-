import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';


const ParentDashboard = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  
  // Data for selected child
  const [attendance, setAttendance] = useState([]);
  const [results, setResults] = useState([]);
  const [fees, setFees] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [tutorJobs, setTutorJobs] = useState([]);
  
  // App state
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [linkIndex, setLinkIndex] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  
  // Leave Form state
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    fetchLinkedChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
  }, [selectedChild]);

  // Fetch all children linked to this parent
  const fetchLinkedChildren = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parent_children')
        .select('child_id, profiles!parent_children_child_id_fkey(id, full_name, index_number, class_number)')
        .eq('parent_id', user.id);

      if (error) throw error;
      
      const mappedChildren = data.map(row => row.profiles);
      setChildren(mappedChildren);
      
      if (mappedChildren.length > 0) {
        setSelectedChild(mappedChildren[0]);
      } else {
        setLoading(false);
      }

      // Fetch pinned announcements
      const { data: annData } = await supabase
        .from('announcements')
        .select('id, title, body, is_pinned, created_at')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false })
        .limit(3);
      if (annData) setAnnouncements(annData);

    } catch (err) {
      console.error('Error fetching linked children:', err);
      setLoading(false);
    }
  };

  // Fetch metrics for selected child
  const fetchChildData = async (childId) => {
    try {
      setDataLoading(true);
      
      // 1. Fetch attendance
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', childId)
        .order('date', { ascending: false });
      setAttendance(attData || []);

      // 2. Fetch results
      const { data: resData } = await supabase
        .from('student_results')
        .select('*')
        .eq('student_id', childId)
        .order('created_at', { ascending: false });
      setResults(resData || []);

      // 3. Fetch fees
      const { data: feesData } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', childId)
        .order('month', { ascending: false });
      setFees(feesData && feesData.length > 0 ? feesData[0] : null);

      // 4. Fetch leave requests
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', childId)
        .order('created_at', { ascending: false });
      setLeaves(leavesData || []);

      // 5. Fetch class teacher jobs
      const { data: jobsData } = await supabase
        .from('tutor_jobs')
        .select('*, profiles(full_name, phone)')
        .limit(5);
      setTutorJobs(jobsData || []);

    } catch (err) {
      console.error('Error fetching child details:', err);
    } finally {
      setDataLoading(false);
      setLoading(false);
    }
  };

  // Link a child by student index number
  const handleLinkChild = async (e) => {
    e.preventDefault();
    setLinkError('');
    setLinkSuccess('');
    
    if (!linkIndex.trim()) return;

    try {
      // Find student profile by index number
      const { data: student, error: studentErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('index_number', linkIndex.trim())
        .eq('account_type', 'student')
        .maybeSingle();

      if (studentErr || !student) {
        setLinkError(i18n.language === 'ar' ? 'لم يتم العثور على طالب برقم القيد هذا' : 'Student index number not found');
        return;
      }

      // Check if already linked
      const { data: existingLink } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', user.id)
        .eq('child_id', student.id)
        .maybeSingle();

      if (existingLink) {
        setLinkError(i18n.language === 'ar' ? 'هذا الطفل مرتبط بالفعل بحسابك' : 'This child is already linked to your account');
        return;
      }

      // Add link
      const { error: insertErr } = await supabase
        .from('parent_children')
        .insert({
          parent_id: user.id,
          child_id: student.id
        });

      if (insertErr) throw insertErr;

      setLinkIndex('');
      setLinkSuccess(i18n.language === 'ar' ? 'تم ربط الحساب بنجاح!' : 'Child linked successfully!');
      fetchLinkedChildren();
    } catch (err) {
      console.error('Error linking child:', err);
      setLinkError('Failed to link child account');
    }
  };

  // Submit Leave request
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
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">👶</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Welcome Header */}
        <div className="glass-panel p-8 rounded-[2rem] border border-emerald-500/20 shadow-glass flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 group hover:border-emerald-500/40 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

          <div className="relative z-10 flex items-center gap-6">
            <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 items-center justify-center shadow-glow-emerald">
              <span className="text-4xl text-white font-arabic">و</span>
            </div>
            <div>
              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-glow-emerald border border-emerald-500/20">
                {i18n.language === 'ar' ? 'بوابة أولياء الأمور' : 'Parent Portal'}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-emerald-500">
                {i18n.language === 'ar' ? `مرحباً بك، ${user?.username}` : `Welcome back, ${user?.username}`}
              </h1>
              <p className="text-sm text-gray-400 mt-1 font-medium">
                {i18n.language === 'ar' 
                  ? 'تابع أنشطة ومستحقات أطفالك الدراسية من مكان واحد'
                  : 'Monitor your children academic performance, attendance, and fees.'}
              </p>
            </div>
          </div>

          {/* Child Switcher Tabs */}
          {children.length > 0 && (
            <div className="relative z-10 flex gap-2 mt-4 md:mt-0 overflow-x-auto py-1 hide-scrollbar">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg hover:-translate-y-1 ${
                    selectedChild?.id === child.id
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-glow-emerald border border-emerald-400/20'
                      : 'bg-gray-900/80 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className="text-xl">👶</span> {child.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pinned Announcements for parents */}
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

        {/* Link Child Panel (If 0 children or want to add) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Link student card */}
          <div className="glass-card rounded-[2rem] p-8 space-y-5 hover:border-emerald-500/30 transition-all duration-300">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-3 font-arabic">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">🔗</span>
              {i18n.language === 'ar' ? 'ربط حساب طفل جديد' : 'Link Child Account'}
            </h3>
            <p className="text-sm text-gray-400">
              {i18n.language === 'ar' 
                ? 'أدخل رقم القيد المخصص لطفلك للوصول إلى تفاصيل حضوره ونتائجه.'
                : 'Enter your child unique student index number to link their profile.'}
            </p>
            <form onSubmit={handleLinkChild} className="space-y-4">
              <input
                type="text"
                value={linkIndex}
                onChange={(e) => setLinkIndex(e.target.value)}
                placeholder="KASHIF-2026-001"
                className="w-full bg-gray-950/50 border border-gray-800 text-sm text-gray-200 placeholder-gray-600 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-shadow focus:shadow-glow-emerald"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg hover:-translate-y-1"
              >
                {i18n.language === 'ar' ? 'ربط الطالب' : 'Link Student'}
              </button>
              {linkError && <p className="text-xs text-red-400 mt-1">{linkError}</p>}
              {linkSuccess && <p className="text-xs text-emerald-400 mt-1">{linkSuccess}</p>}
            </form>
          </div>

          {/* If no children linked yet */}
          {children.length === 0 ? (
            <div className="lg:col-span-2 bg-gray-900/30 backdrop-blur-md rounded-2xl p-12 border border-gray-800/50 text-center flex flex-col items-center justify-center space-y-4">
              <span className="text-5xl">🧸</span>
              <h2 className="text-xl font-bold text-gray-300">
                {i18n.language === 'ar' ? 'لم تقم بربط أي حساب طالب بعد' : 'No children linked to your parent portal'}
              </h2>
              <p className="text-sm text-gray-500 max-w-sm">
                {i18n.language === 'ar'
                  ? 'يرجى ربط حساب ابنك باستخدام رقم القيد المرفق من إدارة الكلية لعرض التقارير.'
                  : 'Please use the linking panel to enter your child index number provided by the college.'}
              </p>
            </div>
          ) : (
            /* Selected Child Details */
            <div className="lg:col-span-2 space-y-8">
              
              {dataLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500"></div>
                </div>
              ) : (
                <>
                  {/* Warning Alerts */}
                  {showAttendanceWarning && (
                    <div className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 p-4 rounded-xl text-red-200">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <h3 className="font-bold text-sm">
                          {i18n.language === 'ar' ? 'تحذير غياب الطالب!' : 'Child Attendance Alert!'}
                        </h3>
                        <p className="text-xs text-red-300">
                          {i18n.language === 'ar'
                            ? `نسبة حضور ${selectedChild?.full_name} هي ${attendanceRate}% وهو أقل من الحد المسموح (85%). يرجى اتخاذ الإجراءات أو تبرير الغياب.`
                            : `${selectedChild?.full_name} has an attendance of ${attendanceRate}%, falling below the required 85%.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Attendance Card & Results Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Attendance summary */}
                    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        📅 {i18n.language === 'ar' ? 'سجل الحضور' : 'Attendance Log'}
                      </h3>
                      <div className="flex justify-between items-center p-3 bg-gray-950/40 rounded-xl border border-gray-800/30">
                        <div className="text-center">
                          <span className="text-2xl font-black text-emerald-400">{attendanceRate}%</span>
                          <p className="text-[10px] text-gray-500 uppercase">{i18n.language === 'ar' ? 'الحضور' : 'Attendance'}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-black text-amber-500">{presentDays}</span>
                          <p className="text-[10px] text-gray-500 uppercase">{i18n.language === 'ar' ? 'أيام الحضور' : 'Present'}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-black text-red-400">{absentDays}</span>
                          <p className="text-[10px] text-gray-500 uppercase">{i18n.language === 'ar' ? 'أيام الغياب' : 'Absent'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Class Teacher Contact */}
                    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        📞 {i18n.language === 'ar' ? 'معلومات معلم الصف' : 'Class Teacher Contact'}
                      </h3>
                      {tutorJobs.slice(0, 1).map(job => (
                        <div key={job.id} className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                          <h4 className="font-bold text-white text-sm">{job.profiles?.full_name}</h4>
                          <p className="text-[11px] text-emerald-400">{job.title}</p>
                          <p className="text-xs text-gray-400 mt-2 font-mono">📱 {job.profiles?.phone || 'N/A'}</p>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Monthly Fees Invoice Log */}
                  <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-6">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      💳 {i18n.language === 'ar' ? 'رسوم الطفل ومستحقاته المالية' : 'Student Fees & Arrears'}
                    </h3>
                    {fees ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3.5 bg-gray-950/40 border border-gray-800/30 rounded-xl text-sm">
                          <div>
                            <span className="text-xs text-gray-500 uppercase">{i18n.language === 'ar' ? 'شهر الرسوم' : 'Bill Month'}</span>
                            <div className="font-bold text-white text-base">{fees.month}</div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            fees.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            fees.status === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {fees.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-gray-950/20 rounded-lg">
                            <div className="text-lg font-bold text-white font-mono">LKR {fees.total_due}</div>
                            <span className="text-[10px] text-gray-500">{i18n.language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                          </div>
                          <div className="p-3 bg-gray-950/20 rounded-lg">
                            <div className="text-lg font-bold text-emerald-400 font-mono">LKR {fees.paid_amount}</div>
                            <span className="text-[10px] text-gray-500">{i18n.language === 'ar' ? 'المدفوع' : 'Paid'}</span>
                          </div>
                          <div className="p-3 bg-gray-950/20 rounded-lg">
                            <div className="text-lg font-bold text-red-400 font-mono">LKR {fees.total_due - fees.paid_amount}</div>
                            <span className="text-[10px] text-gray-500">{i18n.language === 'ar' ? 'المتأخرات' : 'Arrears'}</span>
                          </div>
                        </div>

                        {fees.payments && fees.payments.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{i18n.language === 'ar' ? 'دفعات الرسوم الجزئية' : 'Partial Payment Details'}</span>
                            {fees.payments.map((p, idx) => (
                              <div key={idx} className="flex justify-between text-xs bg-gray-950/30 p-2 rounded">
                                <span className="text-gray-400">{p.date}</span>
                                <span className="font-mono text-emerald-400 font-semibold">+ LKR {p.amount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-gray-500">
                        {i18n.language === 'ar' ? 'لا توجد مستحقات رسوم مفعلة حالياً' : 'No generated monthly fees for this child.'}
                      </div>
                    )}
                  </div>

                  {/* Leave Request Management Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Submit leave request */}
                    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        📝 {i18n.language === 'ar' ? 'طلب إجازة للمستقبل' : 'Submit Leave Request'}
                      </h3>
                      <form onSubmit={handleLeaveSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
                            <input
                              type="date"
                              value={leaveForm.startDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
                            <input
                              type="date"
                              value={leaveForm.endDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'سبب الغياب' : 'Reason'}</label>
                          <textarea
                            value={leaveForm.reason}
                            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none h-16"
                            placeholder={i18n.language === 'ar' ? 'اذكر سبب طلب الإجازة...' : 'Medical, family travel, etc...'}
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-xs transition"
                        >
                          {i18n.language === 'ar' ? 'تقديم الطلب للموافقة' : 'Submit Leave Request'}
                        </button>
                        {leaveSuccess && <p className="text-xs text-emerald-400 text-center animate-pulse">✓ Leave request submitted successfully!</p>}
                        {leaveError && <p className="text-xs text-red-400 text-center">{leaveError}</p>}
                      </form>
                    </div>

                    {/* Past leave requests & teacher responses */}
                    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        📋 {i18n.language === 'ar' ? 'سجل الإجازات والموافقات' : 'Leave Status & Replies'}
                      </h3>
                      {leaves.length === 0 ? (
                        <div className="text-center py-12 text-xs text-gray-500">
                          {i18n.language === 'ar' ? 'لا توجد طلبات إجازة حالية' : 'No submitted leave requests.'}
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                          {leaves.map((lv) => (
                            <div key={lv.id} className="p-3 bg-gray-950/20 border border-gray-800 rounded-xl text-xs space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-gray-400">{lv.start_date} ~ {lv.end_date}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  lv.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                  lv.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                  'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {lv.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-gray-300"><span className="text-gray-500">{i18n.language === 'ar' ? 'السبب: ' : 'Reason: '}</span>{lv.reason}</p>
                              {lv.response_note && (
                                <div className="mt-2 p-2 bg-gray-950/40 border-l border-amber-500 rounded text-[11px] italic text-amber-300">
                                  <span className="font-bold text-gray-400 block not-italic text-[9px] uppercase tracking-wider">{i18n.language === 'ar' ? 'رد المعلم: ' : 'Tutor Reply:'}</span>
                                  {lv.response_note}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Results & Academic report */}
                  <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      🎓 {i18n.language === 'ar' ? 'التقرير الدراسي للطفل' : 'Child Grades Report'}
                    </h3>
                    {results.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-500">
                        {i18n.language === 'ar' ? 'لم تنشر أي نتائج دراسية للامتحانات' : 'No academic reports generated.'}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {results.map((res) => (
                          <div key={res.id} className="flex justify-between items-center p-3 bg-gray-950/40 rounded-xl border border-gray-800/30 text-xs">
                            <div>
                              <div className="font-bold text-white">{res.subject}</div>
                              <div className="text-[10px] text-gray-500">{res.exam_name}</div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-amber-400 font-bold">{res.marks_obtained} / {res.max_marks}</span>
                              <div className="text-[10px] text-emerald-400 font-bold">Grade: {res.grade}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ParentDashboard;
