import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

import { generateFeeReceipt, exportFeesCSV } from '../lib/exportUtils';

const TreasurerDashboard = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  const [students, setStudents] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  
  // Student fee log form state
  const [feeMonth, setFeeMonth] = useState('2026-06');
  const [feeTotalDue, setFeeTotalDue] = useState(5000);
  const [partialPayment, setPartialPayment] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [feeSuccess, setFeeSuccess] = useState(false);
  const [selectedStudentFee, setSelectedStudentFee] = useState(null);
  
  // Tutor salary state
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [salaryMonth, setSalaryMonth] = useState('2026-06');
  const [salaryAmount, setSalaryAmount] = useState(30000);
  const [salaryStatus, setSalaryStatus] = useState('paid');
  const [salarySuccess, setSalarySuccess] = useState(false);
  const [salaryHistories, setSalaryHistories] = useState([]);

  // Report Metrics
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  
  // Fee generation
  const [generatingFees, setGeneratingFees] = useState(false);
  const [genResult, setGenResult] = useState(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTreasurerData();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentFeeDetail(selectedStudent.id, feeMonth);
    }
  }, [selectedStudent, feeMonth]);

  useEffect(() => {
    if (selectedTutor) {
      fetchTutorSalaryHistory(selectedTutor.id);
    }
  }, [selectedTutor]);

  const fetchTreasurerData = async () => {
    try {
      setLoading(true);
      
      // Fetch students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, index_number, class_number')
        .eq('account_type', 'student')
        .eq('is_approved', true)
        .order('full_name');
      setStudents(studentsData || []);

      // Fetch tutors
      const { data: tutorsData } = await supabase
        .from('profiles')
        .select('id, full_name, assigned_tutor_role')
        .eq('account_type', 'tutor')
        .eq('is_approved', true)
        .order('full_name');
      setTutors(tutorsData || []);

      // Fetch reports summary
      const { data: feesData } = await supabase
        .from('student_fees')
        .select('total_due, paid_amount');
      
      let collected = 0;
      let expected = 0;
      feesData?.forEach(f => {
        collected += Number(f.paid_amount || 0);
        expected += Number(f.total_due || 0);
      });
      setTotalCollected(collected);
      setTotalExpected(expected);

    } catch (err) {
      console.error('Error fetching treasurer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch current month fee structure for student
  const fetchStudentFeeDetail = async (studentId, month) => {
    try {
      const { data } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', studentId)
        .eq('month', month)
        .maybeSingle();
      
      setSelectedStudentFee(data || null);
      if (data) {
        setFeeTotalDue(data.total_due);
      } else {
        setFeeTotalDue(5000); // Default standard tuition fee
      }
    } catch (err) {
      console.error('Error fetching student fee logs:', err);
    }
  };

  // Fetch tutor salary reports
  const fetchTutorSalaryHistory = async (tutorId) => {
    try {
      const { data } = await supabase
        .from('tutor_salaries')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('month', { ascending: false });
      setSalaryHistories(data || []);
    } catch (err) {
      console.error('Error fetching salaries log:', err);
    }
  };

  // Log Student Fee partial/completed payment
  const handleLogFeePayment = async (e) => {
    e.preventDefault();
    setFeeSuccess(false);

    if (!selectedStudent) return;
    const paymentVal = Number(partialPayment);
    if (isNaN(paymentVal) || paymentVal <= 0) return;

    try {
      let paid = paymentVal;
      let currentPayments = [];
      let feeId = selectedStudentFee?.id;

      if (selectedStudentFee) {
        paid = Number(selectedStudentFee.paid_amount) + paymentVal;
        currentPayments = selectedStudentFee.payments || [];
      }

      const newPaymentLog = {
        amount: paymentVal,
        date: new Date().toISOString().split('T')[0],
        notes: paymentNote || 'Monthly Fee Payment'
      };

      currentPayments.push(newPaymentLog);

      let status = 'partial';
      if (paid >= feeTotalDue) {
        status = 'completed';
      }

      const { data, error } = await supabase
        .from('student_fees')
        .upsert({
          id: feeId || undefined,
          student_id: selectedStudent.id,
          month: feeMonth,
          total_due: feeTotalDue,
          paid_amount: paid,
          payments: currentPayments,
          status: status
        }, { onConflict: 'student_id, month' })
        .select('*')
        .single();

      if (error) throw error;

      // Update local state
      setSelectedStudentFee(data);
      setPartialPayment('');
      setPaymentNote('');
      setFeeSuccess(true);
      
      // Auto Notify Parent
      const { data: parentLink } = await supabase
        .from('parent_children')
        .select('parent_id')
        .eq('child_id', selectedStudent.id)
        .limit(1);

      if (parentLink && parentLink.length > 0) {
        await supabase.from('notifications').insert({
          user_id: parentLink[0].parent_id,
          title: 'Fee Payment Logged',
          message: `A payment of LKR ${paymentVal} has been credited for your child ${selectedStudent.full_name}. Paid total: LKR ${paid}/${feeTotalDue}.`
        });
      }

      fetchTreasurerData(); // Refresh metrics

      setTimeout(() => setFeeSuccess(false), 3000);
    } catch (err) {
      console.error('Error logging payment:', err);
    }
  };

  // Log Tutor Salary
  const handleUpdateSalary = async (e) => {
    e.preventDefault();
    setSalarySuccess(false);

    if (!selectedTutor) return;

    try {
      // Upsert salary record
      const { error } = await supabase
        .from('tutor_salaries')
        .upsert({
          tutor_id: selectedTutor.id,
          month: salaryMonth,
          amount: salaryAmount,
          status: salaryStatus
        }, { onConflict: 'tutor_id, month' });

      if (error) throw error;

      // Send alert notification to the Tutor
      await supabase.from('notifications').insert({
        user_id: selectedTutor.id,
        title: 'Salary Status Updated',
        message: `Your salary record of LKR ${salaryAmount} for ${salaryMonth} is marked as ${salaryStatus.toUpperCase()}.`
      });

      setSalarySuccess(true);
      fetchTutorSalaryHistory(selectedTutor.id);

      setTimeout(() => setSalarySuccess(false), 3000);
    } catch (err) {
      console.error('Error updating tutor salary:', err);
    }
  };

  // Filter students based on search string
  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.index_number.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Call Edge Function to generate fees for current month
  const handleGenerateFees = async () => {
    setGeneratingFees(true);
    setGenResult(null);
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-fees`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ month: currentMonth }),
        }
      );
      const result = await res.json();
      setGenResult(result);
    } catch (err) {
      setGenResult({ error: err.message });
    } finally {
      setGeneratingFees(false);
      fetchTreasurerData();
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
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-amber-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <div className="glass-panel p-8 rounded-[2rem] border border-amber-500/20 shadow-glass flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-amber-500/40 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

          <div className="relative z-10 flex items-center gap-6">
            <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 items-center justify-center shadow-glow-amber">
              <span className="text-4xl text-white font-arabic">ص</span>
            </div>
            <div>
              <span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-glow-amber border border-amber-500/20">
                {i18n.language === 'ar' ? 'أمين الصندوق' : 'Treasurer Portal'}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                {i18n.language === 'ar' ? 'إدارة الشؤون المالية والحسابات' : 'Financial Ledger & Payouts'}
              </h1>
            </div>
          </div>
          <Link
            to="/dashboard?view=tutor"
            className="relative z-10 px-6 py-3 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-2xl text-sm font-bold transition-all shadow-lg hover:-translate-y-1 flex items-center gap-2"
          >
            ← {i18n.language === 'ar' ? 'العودة لوحة المعلم' : 'Back to Tutor Portal'}
          </Link>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 rounded-[2rem] text-center space-y-3 group hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">💰</div>
            <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">LKR {totalCollected.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{i18n.language === 'ar' ? 'إجمالي المحصلة' : 'Total Fees Collected'}</div>
          </div>
          <div className="glass-card p-8 rounded-[2rem] text-center space-y-3 group hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">📈</div>
            <div className="text-3xl font-black text-blue-400 mt-2 font-mono">LKR {totalExpected.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{i18n.language === 'ar' ? 'المبلغ المتوقع الإجمالي' : 'Total Expected Billings'}</div>
          </div>
          <div className="glass-card p-8 rounded-[2rem] text-center space-y-3 group hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-amber-500/10 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">📉</div>
            <div className="text-3xl font-black text-amber-500 mt-2 font-mono">LKR {(totalExpected - totalCollected).toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{i18n.language === 'ar' ? 'إجمالي المتأخرات والمتبقي' : 'Total Arrears (Pending)'}</div>
          </div>
        </div>

        {/* Auto Fee Generation Panel */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white text-base">
              ⚡ {i18n.language === 'ar' ? 'توليد رسوم الشهر الحالي تلقائياً' : 'Auto-Generate This Month\'s Fees'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {i18n.language === 'ar'
                ? 'يقوم بإنشاء سجل رسوم لكل طالب معتمد للشهر الحالي (متجاهلاً من تم إنشاؤه بالفعل).'
                : 'Creates a fee record for every approved student for the current month. Safe to run multiple times (idempotent).'}
            </p>
            {genResult && (
              <div className={`mt-2 text-xs px-3 py-2 rounded-lg border ${
                genResult.error
                  ? 'bg-red-950/30 border-red-500/30 text-red-300'
                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              }`}>
                {genResult.error ? `❌ ${genResult.error}` : `✅ ${genResult.message}`}
              </div>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => exportFeesCSV([], 'fees_report')}
              className="px-4 py-2.5 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 border border-blue-800/40 rounded-xl text-xs font-bold transition"
            >
              💾 Export CSV
            </button>
            <button
              onClick={handleGenerateFees}
              disabled={generatingFees}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-xs transition"
            >
              {generatingFees ? '⏳ Generating...' : `🚀 ${i18n.language === 'ar' ? 'توليد الرسوم' : 'Generate Fees'}`}
            </button>
          </div>
        </div>

        {/* Student Fee Payment Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Search roster */}
          <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white font-arabic">
              🔍 {i18n.language === 'ar' ? 'البحث عن طالب' : 'Select Student'}
            </h3>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Name or index number..."
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {filteredStudents.map((std) => (
                <div
                  key={std.id}
                  onClick={() => setSelectedStudent(std)}
                  className={`p-2.5 bg-gray-950/20 border border-gray-800/40 rounded-lg text-xs cursor-pointer transition ${
                    selectedStudent?.id === std.id ? 'ring-1 ring-amber-500 bg-gray-950/60' : ''
                  }`}
                >
                  <div className="font-bold text-white">{std.full_name}</div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                    <span>Index: {std.index_number}</span>
                    <span>Class {std.class_number}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Payment logger */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic border-b border-gray-800 pb-4">
              📝 {i18n.language === 'ar' ? 'تسجيل دفعة رسوم شهرية' : 'Student Tuition Logger'}
            </h2>

            {selectedStudent ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex justify-between items-center text-sm">
                  <div>
                    <h4 className="font-bold text-white text-base">{selectedStudent.full_name}</h4>
                    <p className="text-xs text-gray-400 mt-1 font-mono">Index: {selectedStudent.index_number} | Class {selectedStudent.class_number}</p>
                  </div>
                  {selectedStudentFee && (
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded border border-amber-500/20">
                      Paid: LKR {selectedStudentFee.paid_amount} / {selectedStudentFee.total_due}
                    </span>
                  )}
                </div>

                <form onSubmit={handleLogFeePayment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'الشهر المستحق' : 'Billing Month'}</label>
                      <input
                        type="month"
                        value={feeMonth}
                        onChange={(e) => setFeeMonth(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'إجمالي الرسوم المحددة للمقعد' : 'Total Tuition Due (LKR)'}</label>
                      <input
                        type="number"
                        value={feeTotalDue}
                        onChange={(e) => setFeeTotalDue(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'المبلغ المستلم كدفعة جزئية' : 'Deposit Amount (LKR)'}</label>
                      <input
                        type="number"
                        value={partialPayment}
                        onChange={(e) => setPartialPayment(e.target.value)}
                        placeholder="e.g. 500, 1500, 2500"
                        className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'ملاحظة المعاملة' : 'Reference / Remarks'}</label>
                      <input
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="Receipt #, cash, bank transfer..."
                        className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-2 flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 font-bold rounded-xl text-white text-sm transition"
                    >
                      {i18n.language === 'ar' ? 'تسجيل وتحديث الرصيد' : 'Log Payment Deposit'}
                    </button>
                    {selectedStudentFee && (
                      <button
                        type="button"
                        onClick={() => generateFeeReceipt(selectedStudent, selectedStudentFee, user?.username)}
                        className="px-4 py-3 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-800/40 font-bold rounded-xl text-sm transition"
                      >
                        🖨 {i18n.language === 'ar' ? 'طباعة وصل' : 'Print Receipt'}
                      </button>
                    )}
                    {feeSuccess && (
                      <p className="text-sm text-emerald-400 text-center mt-3 animate-pulse">✓ Payment logged and parent notified!</p>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                {i18n.language === 'ar' ? 'الرجاء اختيار طالب لتسجيل الحساب المالي' : 'Please select a student from the list to log a fee payment.'}
              </div>
            )}
          </div>

        </div>

        {/* Tutor Salaries Payouts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Select Tutor */}
          <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white font-arabic">
              🔍 {i18n.language === 'ar' ? 'البحث عن معلم' : 'Select Tutor / Staff'}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {tutors.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTutor(t)}
                  className={`p-2.5 bg-gray-950/20 border border-gray-800/40 rounded-lg text-xs cursor-pointer transition ${
                    selectedTutor?.id === t.id ? 'ring-1 ring-amber-500 bg-gray-950/60' : ''
                  }`}
                >
                  <div className="font-bold text-white">{t.full_name}</div>
                  <span className="text-[10px] text-gray-500 block mt-1">Role: {t.assigned_tutor_role.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Salary logger */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-arabic border-b border-gray-800 pb-4">
              📝 {i18n.language === 'ar' ? 'صرف وتحديث رواتب المعلمين' : 'Tutor Payout Logger'}
            </h2>

            {selectedTutor ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex justify-between items-center text-sm">
                  <div>
                    <h4 className="font-bold text-white text-base">{selectedTutor.full_name}</h4>
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold">Tutor Role: {selectedTutor.assigned_tutor_role}</span>
                  </div>
                </div>

                <form onSubmit={handleUpdateSalary} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'شهر الراتب' : 'Month'}</label>
                    <input
                      type="month"
                      value={salaryMonth}
                      onChange={(e) => setSalaryMonth(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'مبلغ الراتب' : 'Salary Amount (LKR)'}</label>
                    <input
                      type="number"
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{i18n.language === 'ar' ? 'الحالة' : 'Status'}</label>
                    <select
                      value={salaryStatus}
                      onChange={(e) => setSalaryStatus(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 p-2.5 rounded focus:outline-none"
                    >
                      <option value="paid">PAID</option>
                      <option value="pending">PENDING</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 font-bold rounded-xl text-white text-sm transition"
                    >
                      {i18n.language === 'ar' ? 'تحديث وتأكيد الصرف' : 'Log Salary / Payout'}
                    </button>
                    {salarySuccess && (
                      <p className="text-sm text-emerald-400 text-center mt-3 animate-pulse">✓ Salary status updated and tutor notified!</p>
                    )}
                  </div>
                </form>

                {/* Salary histories table */}
                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {i18n.language === 'ar' ? 'السجل المالي الأخير للمعلم' : 'Recent Payout History'}
                  </h4>
                  {salaryHistories.length === 0 ? (
                    <p className="text-xs text-gray-500 py-3">{i18n.language === 'ar' ? 'لا يوجد سجل رواتب' : 'No payout history logged for this tutor.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {salaryHistories.map((sal) => (
                        <div key={sal.id} className="flex justify-between items-center p-2.5 bg-gray-950/20 border border-gray-800/40 rounded-xl text-xs">
                          <span className="font-bold text-white font-mono">{sal.month}</span>
                          <span className="font-mono font-semibold text-amber-400">LKR {sal.amount}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            sal.status === 'paid' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-red-500/25 text-red-400'
                          }`}>
                            {sal.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                {i18n.language === 'ar' ? 'الرجاء اختيار معلم لمراجعة السجل المالي' : 'Please select a tutor from the list to review salary reports.'}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default TreasurerDashboard;
