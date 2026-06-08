import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient';
import { exportFeesCSV, exportResultsCSV } from '../lib/exportUtils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ── Colour Palette ─────────────────────────────────────────────────────────────
const GREEN   = '#1a8a52';
const AMBER   = '#c9a227';
const RED     = '#dc2626';
const BLUE    = '#2563eb';
const PURPLE  = '#7c3aed';
const TEAL    = '#0d9488';
const GRADE_COLORS = { 'A+': GREEN, A: GREEN, B: BLUE, C: AMBER, D: '#f97316', F: RED, Fail: RED };

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      {label && <p className="text-gray-400 mb-1 font-mono">{label}</p>}
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
const KPICard = ({ icon, label, value, sub, color = 'emerald' }) => {
  const colorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber:   'bg-amber-500/10  border-amber-500/20  text-amber-400',
    blue:    'bg-blue-500/10   border-blue-500/20   text-blue-400',
    red:     'bg-red-500/10    border-red-500/20    text-red-400',
    purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${colorMap[color]}`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-black text-white font-mono">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide mt-0.5">{label}</div>
        {sub && <div className="text-[10px] mt-0.5 opacity-70">{sub}</div>}
      </div>
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

  const buildCharts = (fees, results, attendance, profiles) => {
    // ── Fee chart: monthly collected vs outstanding ──────────────────────────
    const feeByMonth = {};
    fees.forEach(f => {
      if (!feeByMonth[f.month]) feeByMonth[f.month] = { month: f.month, collected: 0, outstanding: 0 };
      feeByMonth[f.month].collected  += f.paid_amount || 0;
      feeByMonth[f.month].outstanding += Math.max(0, (f.total_due || 0) - (f.paid_amount || 0));
    });
    const feeData = Object.values(feeByMonth).slice(-6); // Last 6 months
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
        <p className="text-gray-400 text-sm">{ar ? 'تحميل بيانات التحليلات...' : 'Loading analytics data...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            📊 {ar ? 'لوحة التحليلات والإحصاءات' : 'Analytics & Reporting Dashboard'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {ar ? 'نظرة شاملة على الأداء الأكاديمي والمالي للكلية' : 'College-wide academic and financial performance overview'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportFeesCSV(allFees)}
            className="px-4 py-2 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700/40 rounded-xl text-xs font-bold transition"
          >
            💾 {ar ? 'تصدير الرسوم CSV' : 'Export Fees CSV'}
          </button>
          <button
            onClick={() => exportResultsCSV(allResults)}
            className="px-4 py-2 bg-blue-900/50 hover:bg-blue-800/60 text-blue-300 border border-blue-700/40 rounded-xl text-xs font-bold transition"
          >
            💾 {ar ? 'تصدير النتائج CSV' : 'Export Results CSV'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard icon="🎓" label={ar ? 'إجمالي الطلاب' : 'Total Students'} value={kpi.totalStudents} color="emerald" />
        <KPICard icon="👨‍🏫" label={ar ? 'المعلمون' : 'Total Tutors'} value={kpi.totalTutors} color="blue" />
        <KPICard icon="💰" label={ar ? 'رسوم محصلة' : 'Fees Collected'} value={`LKR ${kpi.totalCollected.toLocaleString()}`} color="emerald" />
        <KPICard icon="⚠️" label={ar ? 'متأخرات' : 'Outstanding'} value={`LKR ${kpi.totalOutstanding.toLocaleString()}`} color="red" />
        <KPICard icon="📅" label={ar ? 'معدل الحضور' : 'Avg Attendance'} value={`${kpi.avgAttendance}%`} sub={ar ? 'متوسط الكلية' : 'College average'} color="amber" />
        <KPICard icon="✅" label={ar ? 'نسبة النجاح' : 'Pass Rate'} value={`${kpi.passRate}%`} sub={ar ? 'كل الامتحانات' : 'All exams'} color="purple" />
      </div>

      {/* Charts Row 1: Fee Chart + Attendance Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Fee Chart */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            💳 {ar ? 'الرسوم الشهرية (آخر 6 أشهر)' : 'Monthly Fee Collection (Last 6 Months)'}
          </h3>
          {feeChartData.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">{ar ? 'لا توجد بيانات رسوم' : 'No fee data available'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={feeChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Bar dataKey="collected" name="Collected (LKR)" fill={GREEN} radius={[4,4,0,0]} />
                <Bar dataKey="outstanding" name="Outstanding (LKR)" fill={RED} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance Rate per Class */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            📅 {ar ? 'نسبة الحضور لكل صف' : 'Attendance Rate per Class'}
          </h3>
          {attendanceChart.every(d => d.rate === 0) ? (
            <div className="text-center py-10 text-gray-500 text-sm">{ar ? 'لا توجد بيانات حضور' : 'No attendance data yet'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="class" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                <Bar dataKey="rate" name="Attendance %" radius={[4,4,0,0]}>
                  {attendanceChart.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 85 ? GREEN : entry.rate >= 70 ? AMBER : RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-3 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>≥85% Good</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>70–85% Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>&lt;70% Critical</span>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Grade Pie + Enrollment Line */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Grade Distribution Pie */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            🎓 {ar ? 'توزيع التقديرات' : 'Grade Distribution'}
          </h3>
          {gradeChart.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">{ar ? 'لا توجد بيانات نتائج' : 'No results data yet'}</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={gradeChart}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
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
              <div className="flex flex-col gap-2 text-xs">
                {gradeChart.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: GRADE_COLORS[entry.name] || [GREEN,BLUE,AMBER,TEAL,PURPLE,RED][i % 6] }}
                    />
                    <span className="text-gray-300 font-bold">{entry.name}</span>
                    <span className="text-gray-500">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Student Enrollment Trend */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            📈 {ar ? 'اتجاه التسجيل الشهري' : 'Monthly Student Enrollment Trend'}
          </h3>
          {enrollmentChart.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">{ar ? 'لا توجد بيانات تسجيل' : 'No enrollment data yet'}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={enrollmentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
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
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white">
            ⚠️ {ar ? 'الطلاب ذوو المتأخرات المالية' : 'Students with Outstanding Fee Balances'}
          </h3>
          <button
            onClick={() => exportFeesCSV(allFees.filter(f => f.status !== 'completed'), 'arrears_report')}
            className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-xl text-xs font-bold transition"
          >
            💾 {ar ? 'تصدير المتأخرات' : 'Export Arrears CSV'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-800">
                <th className="py-2 px-3 text-left">{ar ? 'الطالب' : 'Student'}</th>
                <th className="py-2 px-3 text-left">{ar ? 'الصف' : 'Class'}</th>
                <th className="py-2 px-3 text-left">{ar ? 'الشهر' : 'Month'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المستحق' : 'Due'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المدفوع' : 'Paid'}</th>
                <th className="py-2 px-3 text-right">{ar ? 'المتبقي' : 'Balance'}</th>
                <th className="py-2 px-3 text-center">{ar ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {allFees
                .filter(f => f.status !== 'completed')
                .slice(0, 15)
                .map(f => (
                  <tr key={f.id} className="hover:bg-gray-900/30 transition">
                    <td className="py-2.5 px-3 font-medium text-white">{f.profiles?.full_name || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-400">Class {f.profiles?.class_number || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{f.month}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-300">LKR {f.total_due?.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">LKR {f.paid_amount?.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-400 font-bold">
                      LKR {Math.max(0, f.total_due - f.paid_amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        f.status === 'partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                      }`}>{f.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              {allFees.filter(f => f.status !== 'completed').length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-500 text-sm">
                  ✅ {ar ? 'لا توجد متأخرات' : 'No outstanding fees — all students are up to date!'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
