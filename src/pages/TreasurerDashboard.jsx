import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { generateInvoicesInBatches } from '../lib/erp/rpc';
import { toast } from 'react-toastify';
import KhatamPattern from '../components/KhatamPattern';

import { generateFeeReceipt, exportFeesCSV } from '../lib/exportUtils';
import { tx } from '../lib/tx';

const TreasurerDashboard = () => {
  const { user } = useAuth();
  useTranslation(); // re-render on language change

  const [students, setStudents] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  
  // Student fee log form state
  const [feeMonth, setFeeMonth] = useState(new Date().toISOString().slice(0, 7));
  const [feeTotalDue, setFeeTotalDue] = useState(5000);
  const [partialPayment, setPartialPayment] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [feeSuccess, setFeeSuccess] = useState(false);
  const [selectedStudentFee, setSelectedStudentFee] = useState(null);
  
  // Tutor salary state
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryAmount, setSalaryAmount] = useState(30000);
  const [salaryStatus, setSalaryStatus] = useState('paid');
  const [salarySuccess, setSalarySuccess] = useState(false);
  const [salaryHistories, setSalaryHistories] = useState([]);

  // Report Metrics
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [allFeeRows, setAllFeeRows] = useState([]);
  
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
        .select('*, profiles!student_fees_student_id_fkey(full_name, index_number, class_number)');
      
      setAllFeeRows(feesData || []);
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
      // 1. Ensure the month's invoice exists / reflects the agreed total.
      //    (Invoice totals post to the ledger via invoice lines automatically.)
      let fee = selectedStudentFee;
      if (!fee) {
        const { data: created, error: createErr } = await supabase
          .from('student_fees')
          .insert({ student_id: selectedStudent.id, month: feeMonth, total_due: Number(feeTotalDue) })
          .select('*')
          .single();
        if (createErr) throw createErr;
        fee = created;
      } else if (Number(fee.total_due) !== Number(feeTotalDue)) {
        const { data: adjusted, error: adjErr } = await supabase
          .from('student_fees')
          .update({ total_due: Number(feeTotalDue) })
          .eq('id', fee.id)
          .select('*')
          .single();
        if (adjErr) throw adjErr;
        fee = adjusted;
      }

      // 2. Record the receipt in the immutable ledger (numbered receipt,
      //    journal posting, student + parent notifications happen server-side).
      const { data: receipt, error: payErr } = await supabase.rpc('record_fee_payment', {
        p_fee: fee.id,
        p_amount: paymentVal,
        p_method: 'cash',
        p_reference: null,
        p_notes: paymentNote || 'Monthly fee payment',
      });
      if (payErr) throw payErr;

      const { data: refreshed } = await supabase.from('student_fees').select('*').eq('id', fee.id).single();
      setSelectedStudentFee(refreshed || fee);
      setPartialPayment('');
      setPaymentNote('');
      setFeeSuccess(true);
      toast.success(`${tx('تم إصدار الإيصال', 'Receipt issued')}: ${receipt?.receipt_no || ''}`);

      fetchTreasurerData(); // Refresh metrics
      setTimeout(() => setFeeSuccess(false), 3500);
    } catch (err) {
      console.error('Error logging payment:', err);
      toast.error(err?.message || tx('تعذّر تسجيل الدفعة', 'Payment could not be recorded'));
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

      setTimeout(() => setSalarySuccess(false), 3500);
    } catch (err) {
      console.error('Error updating tutor salary:', err);
    }
  };

  // Filter students based on search string
  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.index_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Call Edge Function to generate fees for current month
  const handleGenerateFees = async () => {
    setGeneratingFees(true);
    setGenResult(null);
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
      // bounded batches (~1 s each) with live progress
      const result = await generateInvoicesInBatches({
        month: currentMonth,
        onProgress: (p) => setGenResult({ ...p, inProgress: true }),
      });
      setGenResult(result);
    } catch (err) {
      console.error('Error generating fees:', err);
      setGenResult({ error: err.message || tx('فشل إنشاء الفواتير', 'Generation failed') });
    } finally {
      setGeneratingFees(false);
      fetchTreasurerData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#C29A3A] border-t-transparent animate-spin"></div>
          <p className="text-sm font-sans text-[#4A5E56]">
            {tx('جاري تحميل لوحة الشؤون المالية...', 'Loading financial ledger...')}
          </p>
        </div>
      </div>
    );
  }

  const arrears = Math.max(0, totalExpected - totalCollected);

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] relative overflow-hidden py-8 sm:py-12">
      {/* Background Watermark */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] pointer-events-none opacity-[0.03]">
        <KhatamPattern className="w-full h-full text-[#0B3B2E]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
        
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#C29A3A]"></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center font-arabic text-2xl sm:text-3xl font-bold shrink-0 shadow-sm border border-[#C29A3A]/20">
                ص
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F7EDD2] text-[#C29A3A] border border-[#C29A3A]/20 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C29A3A]"></span>
                  {tx('أمين الصندوق والشؤون المالية', 'Office of the Treasurer')}
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                  {tx('إدارة الشؤون المالية والحسابات', 'Financial Ledger & Fee Collection')}
                </h1>
                <p className="text-xs sm:text-sm text-[#4A5E56] font-sans mt-0.5">
                  {tx('متابعة الرسوم الدراسية، تسجيل الإيداعات، صرف الرواتب، وإصدار الوصولات', 'Tuition collection, deposit logging, salary disbursements & official receipts')}
                </p>
              </div>
            </div>

            <Link
              to="/dashboard?view=tutor"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm"
            >
              <svg className="w-4 h-4 text-[#11694A] stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {tx('العودة لوحة المعلم', 'Back to Tutor Portal')}
            </Link>
          </div>
        </div>

        {/* Analytics Section — 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Collected */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">
                {tx('إجمالي المحصلة', 'Total Fees Collected')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-3xl font-serif font-bold text-[#11694A] font-mono tabular-nums">
              {`LKR ${totalCollected.toLocaleString()}`}
            </div>
            <p className="mt-1 text-xs text-[#4A5E56]">
              {tx('مجموع المدفوعات المسجلة في النظام', 'Cumulative verified receipts')}
            </p>
          </div>

          {/* Expected Billings */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">
                {tx('المبلغ المتوقع الإجمالي', 'Total Expected Billings')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#E0F2F1] text-[#0F7C86] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-3xl font-serif font-bold text-[#0B3B2E] font-mono tabular-nums">
              {`LKR ${totalExpected.toLocaleString()}`}
            </div>
            <p className="mt-1 text-xs text-[#4A5E56]">
              {tx('إجمالي مستحقات الطلاب النشطين', 'Gross active tuition billed')}
            </p>
          </div>

          {/* Arrears */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">
                {tx('إجمالي المتأخرات والمتبقي', 'Total Arrears (Pending)')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-3xl font-serif font-bold text-[#C29A3A] font-mono tabular-nums">
              {`LKR ${arrears.toLocaleString()}`}
            </div>
            <p className="mt-1 text-xs text-[#4A5E56]">
              {tx('المبالغ غير المسددة حتى تاريخه', 'Outstanding student balances')}
            </p>
          </div>
        </div>

        {/* Auto Fee Generation Panel */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-serif font-bold text-base text-[#0B3B2E]">
                {tx('توليد رسوم الشهر الحالي تلقائياً', 'Monthly Fee Generation & Batch Export')}
              </h3>
            </div>
            <p className="text-xs text-[#4A5E56]">
              {tx('يقوم بإنشاء سجل رسوم لكل طالب معتمد للشهر الحالي (عملية آمنة ولا تكرر السجلات الموجودة).', 'Generates standard monthly fee ledger entries for all approved active students. Safe and idempotent.')}
            </p>
            {genResult && (
              <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg border inline-block ${
                genResult.error
                  ? 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]'
                  : 'bg-[#E3F1EA] border-[#11694A]/20 text-[#11694A]'
              }`}>
                {genResult.error
                  ? `${tx('خطأ', 'Error')}: ${genResult.error}`
                  : genResult.inProgress
                    ? tx('جارٍ الإنشاء… {n} فاتورة، المتبقي {r}', 'Generating… {n} invoice(s) so far, {r} remaining')
                        .replace('{n}', genResult.generated).replace('{r}', genResult.remaining)
                    : tx('تم إنشاء {n} فاتورة لشهر {m}. {s} موجودة مسبقاً.', 'Generated {n} invoice(s) for {m}. {s} already existed.')
                        .replace('{n}', genResult.generated).replace('{m}', genResult.month).replace('{s}', genResult.skipped)}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0 self-end md:self-auto">
            <button
              onClick={() => exportFeesCSV(allFeeRows, 'kashiful_hudha_fees_report')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FBF8F0] hover:bg-white text-[#0B3B2E] border border-[#E8E1D0] rounded-xl text-xs font-bold transition shadow-sm"
            >
              <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {tx('تصدير CSV', 'Export CSV')}
            </button>
            <button
              onClick={handleGenerateFees}
              disabled={generatingFees}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#60736C] text-white font-bold rounded-xl text-xs transition shadow-sm"
            >
              {generatingFees ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {tx('جاري التوليد...', 'Generating...')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {tx('توليد الرسوم', 'Generate Monthly Fees')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Student Fee Payment Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Search roster */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E8E1D0]">
              <div className="w-7 h-7 rounded-lg bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-serif font-bold text-[#0B3B2E]">
                {tx('البحث عن طالب', 'Select Student')}
              </h3>
            </div>

            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={tx('الاسم أو رقم القيد...', 'Name or index number...')}
                className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]"
              />
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredStudents.length === 0 ? (
                <p className="text-xs text-[#4A5E56] py-4 text-center">
                  {tx('لا يوجد طلاب مطابقون.', 'No students found matching search.')}
                </p>
              ) : filteredStudents.map((std) => (
                <div
                  key={std.id}
                  onClick={() => setSelectedStudent(std)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedStudent?.id === std.id 
                      ? 'border-[#11694A] bg-[#E3F1EA]/50 font-semibold' 
                      : 'border-[#E8E1D0] bg-[#FBF8F0] hover:border-[#11694A]/40'
                  }`}
                >
                  <div className="font-bold text-[#0B3B2E]">{std.full_name}</div>
                  <div className="flex justify-between items-center text-[10px] text-[#4A5E56] mt-0.5">
                    <span className="font-mono tabular-nums">{tx('رقم القيد:', 'Index:')} {std.index_number}</span>
                    <span>{tx('الفصل {n}', 'Class {n}').replace('{n}', std.class_number)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Payment logger */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8E1D0]">
              <div className="w-8 h-8 rounded-lg bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('تسجيل دفعة رسوم شهرية', 'Student Tuition Logger')}
              </h2>
            </div>

            {selectedStudent ? (
              <div className="space-y-6">
                <div className="p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm">
                  <div>
                    <h4 className="font-bold text-[#0B3B2E] text-base">{selectedStudent.full_name}</h4>
                    <p className="text-xs text-[#4A5E56] mt-0.5 font-mono tabular-nums">
                      {tx('رقم القيد:', 'Index:')} {selectedStudent.index_number} | {tx('الفصل {n}', 'Class {n}').replace('{n}', selectedStudent.class_number)}
                    </p>
                  </div>
                  {selectedStudentFee && (
                    <span className="px-3 py-1 bg-[#E3F1EA] text-[#11694A] text-xs font-bold rounded-lg border border-[#11694A]/20 tabular-nums">
                      {tx('المدفوع:', 'Paid:')} {`LKR ${Number(selectedStudentFee.paid_amount || 0).toLocaleString()} / ${Number(selectedStudentFee.total_due || 0).toLocaleString()}`}
                    </span>
                  )}
                </div>

                <form onSubmit={handleLogFeePayment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('الشهر المستحق', 'Billing Month')}
                    </label>
                    <input
                      type="month"
                      value={feeMonth}
                      onChange={(e) => setFeeMonth(e.target.value)}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('إجمالي الرسوم المحددة', 'Total Tuition Due (LKR)')}
                    </label>
                    <input
                      type="number"
                      value={feeTotalDue}
                      onChange={(e) => setFeeTotalDue(Number(e.target.value))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('المبلغ المستلم كدفعة', 'Deposit Amount (LKR)')}
                    </label>
                    <input
                      type="number"
                      value={partialPayment}
                      onChange={(e) => setPartialPayment(e.target.value)}
                      placeholder={tx('مثال: 500، 1500، 5000', 'e.g. 500, 1500, 5000')}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('رقم الإيصال / ملاحظة', 'Reference / Remarks')}
                    </label>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder={tx('رقم الإيصال، نقداً، تحويل بنكي...', 'Receipt #, cash, bank transfer...')}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-white text-xs sm:text-sm transition shadow-sm"
                    >
                      {tx('تسجيل وتحديث الرصيد', 'Log Payment Deposit')}
                    </button>
                    {selectedStudentFee && (
                      <button
                        type="button"
                        onClick={() => generateFeeReceipt(selectedStudent, selectedStudentFee, user?.username)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-[#FBF8F0] text-[#0B3B2E] border border-[#E8E1D0] font-bold rounded-xl text-xs sm:text-sm transition shadow-sm"
                      >
                        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        {tx('طباعة وصل', 'Print Receipt')}
                      </button>
                    )}
                  </div>
                  {feeSuccess && (
                    <div className="md:col-span-2 text-center">
                      <p className="text-xs text-[#11694A] font-bold animate-pulse">
                        ✓ {tx('تم تسجيل الدفعة وإرسال الإشعار لولي الأمر!', 'Payment logged and parent notified!')}
                      </p>
                    </div>
                  )}
                </form>
              </div>
            ) : (
              <div className="text-center py-16 text-[#4A5E56] text-xs">
                {tx('الرجاء اختيار طالب من القائمة لتسجيل الحساب المالي.', 'Please select a student from the list to log a fee payment.')}
              </div>
            )}
          </div>

        </div>

        {/* Tutor Salaries Payouts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Select Tutor */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E8E1D0]">
              <div className="w-7 h-7 rounded-lg bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-serif font-bold text-[#0B3B2E]">
                {tx('اختيار المعلم أو الموظف', 'Select Tutor / Staff')}
              </h3>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {tutors.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTutor(t)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedTutor?.id === t.id 
                      ? 'border-[#C29A3A] bg-[#F7EDD2]/50 font-semibold' 
                      : 'border-[#E8E1D0] bg-[#FBF8F0] hover:border-[#C29A3A]/40'
                  }`}
                >
                  <div className="font-bold text-[#0B3B2E]">{t.full_name}</div>
                  <span className="text-[10px] text-[#4A5E56] block mt-0.5">
                    {tx('الدور:', 'Role:')} {t.assigned_tutor_role?.toUpperCase() || tx('معلم', 'TUTOR')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Salary logger */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8E1D0]">
              <div className="w-8 h-8 rounded-lg bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('صرف وتحديث رواتب المعلمين', 'Tutor Payout Logger')}
              </h2>
            </div>

            {selectedTutor ? (
              <div className="space-y-6">
                <div className="p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex justify-between items-center text-sm">
                  <div>
                    <h4 className="font-bold text-[#0B3B2E] text-base">{selectedTutor.full_name}</h4>
                    <span className="text-[10px] text-[#0F7C86] uppercase font-bold tracking-wider">
                      {tx('الدور:', 'Role:')} {selectedTutor.assigned_tutor_role || tx('معلم', 'Tutor')}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleUpdateSalary} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('شهر الراتب', 'Month')}
                    </label>
                    <input
                      type="month"
                      value={salaryMonth}
                      onChange={(e) => setSalaryMonth(e.target.value)}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C29A3A]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('مبلغ الراتب', 'Salary Amount (LKR)')}
                    </label>
                    <input
                      type="number"
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(Number(e.target.value))}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C29A3A]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">
                      {tx('الحالة', 'Status')}
                    </label>
                    <select
                      value={salaryStatus}
                      onChange={(e) => setSalaryStatus(e.target.value)}
                      className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C29A3A]"
                    >
                      <option value="paid">{tx('مدفوع', 'PAID')}</option>
                      <option value="pending">{tx('معلّق', 'PENDING')}</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#C29A3A] hover:bg-[#A8822B] font-bold rounded-xl text-[#0B3B2E] text-xs sm:text-sm transition shadow-sm"
                    >
                      {tx('تحديث وتأكيد الصرف', 'Log Salary / Payout')}
                    </button>
                    {salarySuccess && (
                      <p className="text-xs text-[#11694A] text-center mt-2 font-bold animate-pulse">
                        ✓ {tx('تم تحديث حالة الراتب وإشعار المعلم!', 'Salary status updated and tutor notified!')}
                      </p>
                    )}
                  </div>
                </form>

                {/* Salary histories table */}
                <div className="space-y-3 pt-3 border-t border-[#E8E1D0]">
                  <h4 className="text-xs font-bold text-[#4A5E56] uppercase tracking-wider">
                    {tx('السجل المالي الأخير للمعلم', 'Recent Payout History')}
                  </h4>
                  {salaryHistories.length === 0 ? (
                    <p className="text-xs text-[#4A5E56] py-3 text-center">
                      {tx('لا يوجد سجل رواتب سابق لهذا المعلم.', 'No payout history logged for this tutor.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {salaryHistories.map((sal) => (
                        <div key={sal.id} className="flex justify-between items-center p-2.5 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl text-xs">
                          <span className="font-mono font-bold text-[#0B3B2E] tabular-nums">{sal.month}</span>
                          <span className="font-mono font-semibold text-[#11694A] tabular-nums">{`LKR ${Number(sal.amount).toLocaleString()}`}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sal.status === 'paid' ? 'bg-[#E3F1EA] text-[#11694A]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                          }`}>
                            {sal.status === 'paid' ? tx('مدفوع', 'PAID') : tx('معلّق', 'PENDING')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[#4A5E56] text-xs">
                {tx('الرجاء اختيار معلم من القائمة لمراجعة السجل المالي.', 'Please select a tutor from the list to review salary reports.')}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default TreasurerDashboard;
