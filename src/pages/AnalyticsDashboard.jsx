import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient';
import { exportFeesCSV, exportResultsCSV } from '../lib/exportUtils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ── Colour Palette (Modern Manuscript) ─────────────────────────────────────────
const GREEN   = '#11694A';
const AMBER   = '#C29A3A';
const RED     = '#B91C1C';
const BLUE    = '#0F7C86';
const PURPLE  = '#3949AB';
const TEAL    = '#047857';
const GRADE_COLORS = { 'A+': GREEN, A: GREEN, B: BLUE, C: AMBER, D: '#EA580C', F: RED, Fail: RED };

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E1D0] rounded-xl p-3 shadow-md text-xs text-[#0B3B2E]">
      {label && <p className="text-[#4A5E56] mb-1 font-mono">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('lkr')
            ? `LKR ${p.value.toLocaleString()}`
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, color = 'emerald' }) => {
  const colorMap = {
    emerald: 'bg-[#E3F1EA] text-[#11694A]',
    amber:   'bg-[#F7EDD2] text-[#C29A3A]',
    blue:    'bg-[#E0F2F1] text-[#0F7C86]',
    red:     'bg-[#FEE2E2] text-[#B91C1C]',
    purple:  'bg-[#E8EAF6] text-[#3949AB]',
  };
  return (
    <div className="bg-white rounded-2xl border border-[#E8E1D0] p-4 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-1">
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colorMap[color] || colorMap.emerald}`}>
        {color.toUpperCase()}
      </span>
      <div className="text-xl sm:text-2xl font-serif font-bold text-[#0B3B2E] font-mono tabular-nums">
        {value}
      </div>
      <div className="text-[11px] font-semibold text-[#4A5E56] uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-[#4A5E56] opacity-80">{sub}</div>}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const AnalyticsDashboard = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [loading, setLoading] = useState(true);

  // Raw data
  const [allFees, setAllFees]       = useState([]);
  const [allResults, setAllResults] = useState([]);

  // Computed chart data
  const [feeChartData, setFeeChartData]         = useState([]);
  const [attendanceChart, setAttendanceChart]   = useState([]);
  const [gradeChart, setGradeChart]             = useState([]);
  const [enrollmentChart, setEnrollmentChart]   = useState([]);

  // KPI totals
  const [kpi, setKpi] = useState({
    totalStudents: 0, totalTutors: 0,
    totalCollected: 0, totalOutstanding: 0,
    avgAttendance: 0, passRate: 0,
  });

  const buildCharts = (fees, results, attendance, profiles) => {
    // ── Fee chart: monthly collected vs outstanding ──────────────────────────
    const feeByMonth = {};
    fees.forEach(f => {
      if (!feeByMonth[f.month]) feeByMonth[f.month] = { month: f.month, collected: 0, outstanding: 0 };
      feeByMonth[f.month].collected  += f.paid_amount || 0;
      feeByMonth[f.month].outstanding += Math.max(0, (f.total_due || 0) - (f.paid_amount || 0));
    });
    const feeData = Object.values(feeByMonth).slice(-6);
    setFeeChartData(feeData);

    // ── Attendance chart: % per class ────────────────────────────────────────
    const attByClass = {};
    [1,2,3,4,5,6,7].forEach(c => { attByClass[c] = { present: 0, total: 0 }; });
    attendance.forEach(a => {
      const cls = a.profiles?.class_number;
      if (!cls || !attByClass[cls]) return;
      attByClass[cls].total++;
      if (a.status === 'present' || a.status === 'late') attByClass[cls].present++;
    });
    const attData = Object.entries(attByClass).map(([cls, v]) => ({
      class: `Class ${cls}`,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));
    setAttendanceChart(attData);

    // ── Grade distribution pie ───────────────────────────────────────────────
    const gradeCounts = {};
    results.forEach(r => {
      const g = r.grade || 'Unknown';
      gradeCounts[g] = (gradeCounts[g] || 0) + 1;
    });
    setGradeChart(Object.entries(gradeCounts).map(([name, value]) => ({ name, value })));

    // ── Enrollment trend (students registered by month) ──────────────────────
    const stuByMonth = {};
    profiles.filter(p => p.account_type === 'student').forEach(p => {
      const m = p.created_at?.slice(0, 7);
      if (m) stuByMonth[m] = (stuByMonth[m] || 0) + 1;
    });
    const enrollData = Object.entries(stuByMonth)
      .sort(([a],[b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, students: count }));
    setEnrollmentChart(enrollData);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const students = profiles.filter(p => p.account_type === 'student').length;
    const tutors   = profiles.filter(p => p.account_type === 'tutor').length;
    const collected = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);
    const outstanding = fees.reduce((s, f) => s + Math.max(0, (f.total_due || 0) - (f.paid_amount || 0)), 0);
    const totalAtt = attendance.length;
    const presentAtt = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const avgAtt = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
    const passCount = results.filter(r => r.grade && !['F','Fail'].includes(r.grade)).length;
    const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

    setKpi({ totalStudents: students, totalTutors: tutors, totalCollected: collected, totalOutstanding: outstanding, avgAttendance: avgAtt, passRate });
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: fees },
        { data: results },
        { data: attendance },
        { data: profiles },
      ] = await Promise.all([
        supabase.from('student_fees').select('*, profiles!student_fees_student_id_fkey(full_name, index_number, class_number)').order('month'),
        supabase.from('student_results').select('*, profiles!student_results_student_id_fkey(full_name, class_number)').order('created_at'),
        supabase.from('attendance').select('student_id, date, status, profiles!attendance_student_id_fkey(class_number)').order('date'),
        supabase.from('profiles').select('id, account_type, is_approved, class_number, created_at').eq('is_approved', true),
      ]);

      setAllFees(fees || []);
      setAllResults(results || []);

      buildCharts(fees || [], results || [], attendance || [], profiles || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#4A5E56]">
        <div className="w-10 h-10 border-2 border-[#11694A] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-sans">{ar ? 'تحميل بيانات التحليلات...' : 'Loading analytics...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#E8E1D0]">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#0B3B2E]">
            {ar ? 'لوحة التحليلات والإحصاءات المؤسسية' : 'Institutional Analytics & Reporting'}
          </h2>
          <p className="text-xs text-[#4A5E56] mt-0.5">
            {ar ? 'نظرة شاملة على الأداء الأكاديمي والمالي للكلية' : 'Comprehensive academic performance, student attendance & financial metrics'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportFeesCSV(allFees)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E3F1EA] hover:bg-[#11694A] hover:text-white text-[#11694A] rounded-xl text-xs font-bold transition shadow-sm"
          >
            <svg className="w-3.5 h-3.5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {ar ? 'تصدير الرسوم CSV' : 'Export Fees CSV'}
          </button>
          <button
            onClick={() => exportResultsCSV(allResults)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E0F2F1] hover:bg-[#0F7C86] hover:text-white text-[#0F7C86] rounded-xl text-xs font-bold transition shadow-sm"
          >
            <svg className="w-3.5 h-3.5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {ar ? 'تصدير النتائج CSV' : 'Export Results CSV'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <KPICard label={ar ? 'إجمالي الطلاب' : 'Total Students'} value={kpi.totalStudents} color="emerald" />
        <KPICard label={ar ? 'المعلمون' : 'Total Tutors'} value={kpi.totalTutors} color="blue" />
        <KPICard label={ar ? 'رسوم محصلة' : 'Fees Collected'} value={`LKR ${kpi.totalCollected.toLocaleString()}`} color="emerald" />
        <KPICard label={ar ? 'متأخرات' : 'Outstanding'} value={`LKR ${kpi.totalOutstanding.toLocaleString()}`} color="red" />
        <KPICard label={ar ? 'معدل الحضور' : 'Avg Attendance'} value={`${kpi.avgAttendance}%`} sub={ar ? 'متوسط الكلية' : 'College average'} color="amber" />
        <KPICard label={ar ? 'نسبة النجاح' : 'Pass Rate'} value={`${kpi.passRate}%`} sub={ar ? 'كل الامتحانات' : 'All exams'} color="purple" />
      </div>

      {/* Charts Row 1: Fee Chart + Attendance Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Fee Chart */}
        <div className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
            {ar ? 'الرسوم الشهرية (آخر 6 أشهر)' : 'Monthly Fee Collection (Last 6 Months)'}
          </h3>
          {feeChartData.length === 0 ? (
            <div className="text-center py-10 text-[#4A5E56] text-xs">{ar ? 'لا توجد بيانات رسوم' : 'No fee data available'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={feeChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D0" />
                <XAxis dataKey="month" tick={{ fill: '#4A5E56', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4A5E56', fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#4A5E56' }} />
                <Bar dataKey="collected" name="Collected (LKR)" fill={GREEN} radius={[4,4,0,0]} />
                <Bar dataKey="outstanding" name="Outstanding (LKR)" fill={RED} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance Rate per Class */}
        <div className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
            {ar ? 'نسبة الحضور لكل صف' : 'Attendance Rate per Class'}
          </h3>
          {attendanceChart.every(d => d.rate === 0) ? (
            <div className="text-center py-10 text-[#4A5E56] text-xs">{ar ? 'لا توجد بيانات حضور' : 'No attendance data yet'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={attendanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D0" />
                <XAxis dataKey="class" tick={{ fill: '#4A5E56', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#4A5E56', fontSize: 10 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                <Bar dataKey="rate" name="Attendance %" radius={[4,4,0,0]}>
                  {attendanceChart.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 85 ? GREEN : entry.rate >= 70 ? AMBER : RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 pt-1 text-[10px] text-[#4A5E56]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#11694A] inline-block"></span>≥85% Optimal</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C29A3A] inline-block"></span>70–85% Caution</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#B91C1C] inline-block"></span>&lt;70% Critical</span>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Grade Pie + Enrollment Line */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Grade Distribution Pie */}
        <div className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
            {ar ? 'توزيع التقديرات والدرجات' : 'Exam Grade Distribution'}
          </h3>
          {gradeChart.length === 0 ? (
            <div className="text-center py-10 text-[#4A5E56] text-xs">{ar ? 'لا توجد بيانات نتائج' : 'No results data yet'}</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={gradeChart}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {gradeChart.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={GRADE_COLORS[entry.name] || [GREEN,BLUE,AMBER,TEAL,PURPLE,RED][i % 6]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 text-xs">
                {gradeChart.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: GRADE_COLORS[entry.name] || [GREEN,BLUE,AMBER,TEAL,PURPLE,RED][i % 6] }}
                    />
                    <span className="text-[#0B3B2E] font-bold">{entry.name}</span>
                    <span className="text-[#4A5E56]">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Student Enrollment Trend */}
        <div className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
            {ar ? 'اتجاه التسجيل الشهري' : 'Monthly Student Enrollment Trend'}
          </h3>
          {enrollmentChart.length === 0 ? (
            <div className="text-center py-10 text-[#4A5E56] text-xs">{ar ? 'لا توجد بيانات تسجيل' : 'No enrollment data yet'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={enrollmentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D0" />
                <XAxis dataKey="month" tick={{ fill: '#4A5E56', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#4A5E56', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="students"
                  name="New Students"
                  stroke={AMBER}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: AMBER }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed Fee Arrears Table */}
      <div className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#E8E1D0]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
            {ar ? 'الطلاب ذوو المتأخرات المالية' : 'Students with Outstanding Fee Balances'}
          </h3>
          <button
            onClick={() => exportFeesCSV(allFees.filter(f => f.status !== 'completed'), 'arrears_report')}
            className="px-3 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] rounded-lg text-xs font-bold transition"
          >
            {ar ? 'تصدير المتأخرات' : 'Export Arrears CSV'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                <th className="py-2 px-3 text-left">{ar ? 'الطالب' : 'Student'}</th>
                <th className="py-2 px-3 text-left">{ar ? 'الصف' : 'Class'}</th>
                <th className="py-2 px-3 text-left">{ar ? 'الشهر' : 'Month'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المستحق' : 'Due'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المدفوع' : 'Paid'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المتبقي' : 'Balance'}</th>
                <th className="py-2 px-3 text-center">{ar ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E1D0]">
              {allFees
                .filter(f => f.status !== 'completed')
                .slice(0, 15)
                .map(f => (
                  <tr key={f.id} className="hover:bg-white transition">
                    <td className="py-2.5 px-3 font-bold text-[#0B3B2E]">{f.profiles?.full_name || '—'}</td>
                    <td className="py-2.5 px-3 text-[#4A5E56]">Class {f.profiles?.class_number || '—'}</td>
                    <td className="py-2.5 px-3 text-[#4A5E56] font-mono tabular-nums">{f.month}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B]">LKR {Number(f.total_due || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#11694A]">LKR {Number(f.paid_amount || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B91C1C] font-bold">
                      LKR {Math.max(0, (f.total_due || 0) - (f.paid_amount || 0)).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        f.status === 'partial' ? 'bg-[#F7EDD2] text-[#C29A3A]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                      }`}>{f.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              {allFees.filter(f => f.status !== 'completed').length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#4A5E56]">
                    ✓ {ar ? 'لا توجد متأخرات مالية — جميع الرسوم مستوفاة!' : 'No outstanding fees — all balances cleared!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
