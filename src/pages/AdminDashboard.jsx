import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { adminStats, listAdmissionsByStatus, updateAdmissionStatus } from '../lib/admissionsApi';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AnalyticsDashboard from './AnalyticsDashboard';
import AdminContentCMS from '../components/AdminContentCMS';
import { approveProfile } from '../lib/notifyApi';
import AdmissionsCrmBoard from '../components/AdmissionsCrmBoard';
import StaffHrmPanel from '../components/StaffHrmPanel';
import ImportJobsPanel from '../components/ImportJobsPanel';
import OrgAdminPanel from '../components/OrgAdminPanel';
import KhatamPattern from '../components/KhatamPattern';

const COLORS = ['#11694A', '#C29A3A', '#0F7C86', '#B91C1C'];

const AdminDashboard = () => {
  const { user, isAdmin, logout, loading: authLoading } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  
  // Existing state
  const [stats, setStats] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admissions');
  const [contentSection, setContentSection] = useState('news');

  // Approval queue
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  // Tutors role manager
  const [tutors, setTutors] = useState([]);
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [assignedRole, setAssignedRole] = useState('none');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobSuccess, setJobSuccess] = useState(false);

  // Broadcast tool
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Index pre-seeding
  const [newIndexNumber, setNewIndexNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newIndexClass, setNewIndexClass] = useState(5);
  const [indexList, setIndexList] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [authLoading, isAdmin, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, admissionsData] = await Promise.all([
        adminStats(),
        listAdmissionsByStatus('pending')
      ]);
      setStats(statsData);
      setAdmissions(admissionsData);

      const { data: approvalsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .in('account_type', ['student', 'tutor'])
        .order('created_at', { ascending: false });
      setPendingApprovals(approvalsData || []);

      const { data: tutorsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_type', 'tutor')
        .eq('is_approved', true)
        .order('full_name');
      setTutors(tutorsData || []);

      const { data: indexes } = await supabase
        .from('valid_index_numbers')
        .select('*')
        .order('created_at', { ascending: false });
      setIndexList(indexes || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateAdmissionStatus(id, status);
      toast.success(`Admission ${status} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error updating admission:', error);
      toast.error('Failed to update admission status');
    }
  };

  const handleApproveUser = async (profileId) => {
    try {
      const profile = pendingApprovals.find((p) => p.id === profileId);
      await approveProfile(profileId);

      if (profile?.account_type === 'student') {
        const { data: links } = await supabase
          .from('parent_children')
          .select('parent_id')
          .eq('child_id', profileId);
        if (!links?.length) {
          toast.info('Approved. Link parent to dispatch real-time activation alerts.');
        } else {
          toast.success('Approved and parents notified.');
        }
      } else {
        toast.success('User account approved successfully!');
      }
      fetchData();
    } catch (err) {
      console.error('Error approving user:', err);
      toast.error('Failed to approve user account');
    }
  };

  const handleRejectUser = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Registration request rejected and profile removed.');
      fetchData();
    } catch (err) {
      console.error('Error rejecting user:', err);
      toast.error('Failed to reject registration request');
    }
  };

  const handleAssignTutorRole = async (e) => {
    e.preventDefault();
    if (!selectedTutorId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ assigned_tutor_role: assignedRole })
        .eq('id', selectedTutorId);

      if (error) throw error;
      if (assignedRole === 'none') {
        toast.success('Tutor role updated successfully!');
        fetchData();
        return;
      }
      
      const { error: jobError } = await supabase.from('tutor_jobs').insert({
        tutor_id: selectedTutorId,
        title: assignedRole.toUpperCase(),
        description: `Responsible for college administrative and financial oversight as ${assignedRole}.`
      });

      if (jobError) throw jobError;

      toast.success('Tutor role and job updated successfully!');
      fetchData();
    } catch (err) {
      console.error('Error assigning tutor role:', err);
      toast.error('Failed to assign tutor role');
    }
  };

  const handleAddTutorJob = async (e) => {
    e.preventDefault();
    if (!selectedTutorId || !jobTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('tutor_jobs')
        .insert({
          tutor_id: selectedTutorId,
          title: jobTitle,
          description: jobDesc
        });

      if (error) throw error;
      setJobTitle('');
      setJobDesc('');
      setJobSuccess(true);
      toast.success('Tutor responsibility assigned successfully!');
      setTimeout(() => setJobSuccess(false), 3500);
      fetchData();
    } catch (err) {
      console.error('Error adding tutor job:', err);
      toast.error('Failed to assign tutor job');
    }
  };

  const handleAddIndexNumber = async (e) => {
    e.preventDefault();
    if (!newIndexNumber.trim() || !newStudentName.trim()) return;

    try {
      const { error } = await supabase
        .from('valid_index_numbers')
        .insert({
          index_number: newIndexNumber.trim(),
          student_name: newStudentName.trim(),
          class_number: newIndexClass
        });

      if (error) throw error;
      setNewIndexNumber('');
      setNewStudentName('');
      toast.success('Index number registered successfully!');
      fetchData();
    } catch (err) {
      console.error('Error adding index number:', err);
      toast.error('Failed to register index number');
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;

    try {
      let query = supabase.from('profiles').select('id');
      if (broadcastTarget === 'students') query = query.eq('account_type', 'student');
      else if (broadcastTarget === 'parents') query = query.eq('account_type', 'parent');
      else if (broadcastTarget === 'tutors') query = query.eq('account_type', 'tutor');

      const { data: targets, error } = await query;
      if (error) throw error;

      if (targets && targets.length > 0) {
        const notificationsPayload = targets.map((t) => ({
          user_id: t.id,
          title: broadcastTitle,
          message: broadcastMsg
        }));
        
        const { error: notificationError } = await supabase.from('notifications').insert(notificationsPayload);
        if (notificationError) throw notificationError;
      }

      setBroadcastTitle('');
      setBroadcastMsg('');
      setBroadcastSuccess(true);
      toast.success(ar ? 'تم إرسال الإشعار لجميع الفئات المستهدفة' : 'Bilingual broadcast dispatched!');
      setTimeout(() => setBroadcastSuccess(false), 3500);
    } catch (err) {
      console.error('Error sending broadcast:', err);
      toast.error('Failed to dispatch broadcast');
    }
  };

  const handleTriggerFeeReminder = async () => {
    try {
      const { data: studentsList, error } = await supabase
        .from('profiles')
        .select('id, full_name, parent_children(parent_id)')
        .eq('account_type', 'student')
        .eq('is_approved', true);
      if (error) throw error;

      if (studentsList && studentsList.length > 0) {
        const monthString = new Date().toISOString().substring(0, 7);
        
        for (const student of studentsList) {
          await supabase
            .from('student_fees')
            .upsert({
              student_id: student.id,
              month: monthString,
              total_due: 5000.00
            }, { onConflict: 'student_id, month' });

          const parentId = student.parent_children?.[0]?.parent_id;
          if (parentId) {
            await supabase.from('notifications').insert({
              user_id: parentId,
              title: 'Monthly Tuition Fee Reminder',
              message: `Reminder: Tuition fee of LKR 5000 is generated for ${student.full_name} for ${monthString}.`
            });
          }
        }
      }
      toast.success('Monthly fee reminders dispatched to all active parents!');
    } catch (err) {
      console.error('Error triggering fee reminders:', err);
      toast.error('Failed to dispatch fee reminders');
    }
  };

  const admissionStatusData = stats ? [
    { name: ar ? 'قيد الانتظار' : 'Pending', value: stats.admissions?.pending || 0 },
    { name: ar ? 'تمت الموافقة' : 'Approved', value: stats.admissions?.approved || 0 },
    { name: ar ? 'مرفوض' : 'Rejected', value: stats.admissions?.rejected || 0 },
  ] : [];

  const contentSummaryData = stats ? [
    { name: 'News', count: stats.content?.news || 0 },
    { name: 'Faculty', count: stats.content?.faculty || 0 },
    { name: 'Curriculum', count: stats.content?.curriculum || 0 },
    { name: 'Gallery', count: stats.content?.gallery || 0 },
    { name: 'Courses', count: stats.content?.courses || 0 },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#11694A] border-t-transparent animate-spin"></div>
          <p className="text-sm font-sans text-[#4A5E56]">
            {ar ? 'جاري تحميل لوحة الإدارة العامة...' : 'Loading central admin console...'}
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'admissions', label_en: 'Inquiries', label_ar: 'الطلبات', badge: admissions.length },
    { id: 'crm', label_en: 'CRM Pipeline', label_ar: 'مسار القبول' },
    { id: 'hrm', label_en: 'Staff HRM', label_ar: 'الموارد البشرية' },
    { id: 'imports', label_en: 'Shamela Import', label_ar: 'استيراد الشاملة' },
    { id: 'org', label_en: 'Organization', label_ar: 'المؤسسة' },
    { id: 'approvals', label_en: 'Signups', label_ar: 'الموافقات', badge: pendingApprovals.length },
    { id: 'tutors', label_en: 'Tutors & Roles', label_ar: 'المعلمون والوظائف' },
    { id: 'broadcast', label_en: 'Broadcast', label_ar: 'البث' },
    { id: 'content', label_en: 'Content CMS', label_ar: 'إدارة المحتوى' },
    { id: 'indexes', label_en: 'Index Pre-seed', label_ar: 'أرقام القيد' },
    { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات' },
  ];

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] relative overflow-hidden py-8 sm:py-12">
      {/* Background Watermark */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] pointer-events-none opacity-[0.03]">
        <KhatamPattern className="w-full h-full text-[#0B3B2E]" />
      </div>

      <ToastContainer position="top-right" theme="light" autoClose={3000} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
        
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#11694A]"></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center font-arabic text-2xl sm:text-3xl font-bold shrink-0 shadow-sm border border-[#11694A]/20">
                إ
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F1EA] text-[#11694A] border border-[#11694A]/20 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#11694A]"></span>
                  {ar ? 'لوحة التحكم الإدارية المركزية' : 'Super Administrator Console'}
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                  {ar ? `مرحباً، ${user?.username || 'المدير'}` : `Welcome, ${user?.username || 'Administrator'}`}
                </h1>
                <p className="text-xs sm:text-sm text-[#4A5E56] font-sans mt-0.5">
                  {ar ? 'إدارة القبول، الموارد البشرية، المحتوى، والموافقات العامة' : 'College operations, CRM pipeline, HRM records, content CMS & system security'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-sans font-semibold text-xs sm:text-sm rounded-xl transition"
              >
                <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {ar ? 'تسجيل الخروج' : 'Logout'}
              </button>
            </div>
          </div>
        </div>

        {/* Charts & Analytics Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E8E1D0] shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E8E1D0]">
              <h2 className="text-base font-serif font-bold text-[#0B3B2E]">
                {ar ? 'تحليلات طلبات القبول' : 'Admissions Pipeline Funnel'}
              </h2>
              <span className="text-xs text-[#4A5E56]">Real-time</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={admissionStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  innerRadius={50}
                  fill="#11694A"
                  dataKey="value"
                  paddingAngle={4}
                >
                  {admissionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E8E1D0', color: '#0B3B2E' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E8E1D0] shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E8E1D0]">
              <h2 className="text-base font-serif font-bold text-[#0B3B2E]">
                {ar ? 'المحتوى والإحصائيات العامة' : 'CMS Content Breakdown'}
              </h2>
              <span className="text-xs text-[#4A5E56]">Total items</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contentSummaryData}>
                <XAxis dataKey="name" stroke="#4A5E56" tick={{ fill: '#4A5E56', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#4A5E56" tick={{ fill: '#4A5E56', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E8E1D0' }} />
                <Bar dataKey="count" fill="#11694A" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tab Navigation Segmented Bar */}
        <div className="bg-white p-1.5 rounded-2xl border border-[#E8E1D0] shadow-sm flex overflow-x-auto gap-1 hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[125px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-sans font-semibold text-xs whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0B3B2E] text-white shadow-sm'
                  : 'text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-[#FBF8F0]'
              }`}
            >
              <span>{ar ? tab.label_ar : tab.label_en}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-[#C29A3A] text-[#0B3B2E]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Dynamic Panels */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] min-h-[480px]">
          
          {/* CRM Panel */}
          {activeTab === 'crm' && <AdmissionsCrmBoard />}

          {/* HRM Panel */}
          {activeTab === 'hrm' && <StaffHrmPanel />}

          {/* Shamela Imports */}
          {activeTab === 'imports' && <ImportJobsPanel />}

          {/* Org Panel */}
          {activeTab === 'org' && <OrgAdminPanel />}

          {/* Tab 1: Admissions Review */}
          {activeTab === 'admissions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {ar ? 'طلبات القبول المعلقة للتحقق' : 'Admissions Inquiries Queue'}
              </h2>
              {admissions.length === 0 ? (
                <p className="text-xs text-[#4A5E56] py-12 text-center">
                  ✓ {ar ? 'لا توجد طلبات قبول معلقة حالياً.' : 'No pending admissions inquiries.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                        <th className="py-2.5 px-4">{ar ? 'اسم الطالب' : 'Student'}</th>
                        <th className="py-2.5 px-4">{ar ? 'ولي الأمر' : 'Parent'}</th>
                        <th className="py-2.5 px-4">{ar ? 'الدورة' : 'Course'}</th>
                        <th className="py-2.5 px-4 text-center">{ar ? 'الإجراء' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E1D0]">
                      {admissions.map((admission) => (
                        <tr key={admission._id} className="hover:bg-[#FBF8F0] transition">
                          <td className="py-3 px-4 font-bold text-[#0B3B2E]">{admission.studentName}</td>
                          <td className="py-3 px-4 text-[#4A5E56]">{admission.parentName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#11694A] uppercase">{admission.course}</td>
                          <td className="py-3 px-4 text-center space-x-2">
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'approved')}
                              className="px-3 py-1 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-lg text-[11px] transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'rejected')}
                              className="px-3 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-bold rounded-lg text-[11px] transition"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Signup Approval Queue */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {ar ? 'الموافقات على تسجيل الطلاب والمعلمين' : 'User Signup Approvals Queue'}
              </h2>
              {pendingApprovals.length === 0 ? (
                <p className="text-xs text-[#4A5E56] py-12 text-center">
                  ✓ {ar ? 'لا يوجد مستخدمون في قائمة الانتظار.' : 'No users waiting in the approval queue.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                        <th className="py-2.5 px-4">Name</th>
                        <th className="py-2.5 px-4">Email</th>
                        <th className="py-2.5 px-4">Role Type</th>
                        <th className="py-2.5 px-4">Index Details</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E1D0]">
                      {pendingApprovals.map((profile) => (
                        <tr key={profile.id} className="hover:bg-[#FBF8F0] transition">
                          <td className="py-3 px-4 font-bold text-[#0B3B2E]">{profile.full_name}</td>
                          <td className="py-3 px-4 font-mono text-[#4A5E56]">{profile.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              profile.account_type === 'tutor' ? 'bg-[#E0F2F1] text-[#0F7C86]' : 'bg-[#E3F1EA] text-[#11694A]'
                            }`}>
                              {profile.account_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#4A5E56]">{profile.index_number || 'N/A'}</td>
                          <td className="py-3 px-4 text-center space-x-2">
                            <button
                              onClick={() => handleApproveUser(profile.id)}
                              className="px-3 py-1 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-lg text-[11px] transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectUser(profile.id)}
                              className="px-3 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-bold rounded-lg text-[11px] transition"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Tutor roles and job assignments */}
          {activeTab === 'tutors' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Assign Special Role */}
                <form onSubmit={handleAssignTutorRole} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Assign Special Administrative Role</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Select Faculty Member</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Tutor --</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name} ({t.assigned_tutor_role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Designated Role</label>
                    <select
                      value={assignedRole}
                      onChange={(e) => setAssignedRole(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                    >
                      <option value="none">NONE (Regular Tutor)</option>
                      <option value="principal">PRINCIPAL</option>
                      <option value="vice_principal">VICE PRINCIPAL</option>
                      <option value="treasurer">TREASURER (Financial Auditor)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    Update Tutor Assignment
                  </button>
                </form>

                {/* Annual Responsibility Job */}
                <form onSubmit={handleAddTutorJob} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Assign Annual Job Responsibility</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Select Tutor</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Tutor --</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Class 5 Master, Dean of Quranic Studies"
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Job Scope</label>
                    <textarea
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      placeholder="Annual duties..."
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none resize-none h-14"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    Assign Annual Job
                  </button>
                  {jobSuccess && <p className="text-xs text-[#11694A] text-center font-bold animate-pulse">✓ Responsibility updated successfully!</p>}
                </form>

              </div>
            </div>
          )}

          {/* Tab 4: Broadcast */}
          {activeTab === 'broadcast' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Compose Broadcast Notification */}
                <form onSubmit={handleSendBroadcast} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Compose Broadcast Notification</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Target Audience</label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                    >
                      <option value="all">ALL USERS</option>
                      <option value="students">STUDENTS ONLY</option>
                      <option value="parents">PARENTS ONLY</option>
                      <option value="tutors">TUTORS ONLY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Broadcast Title</label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="Notification title..."
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Message</label>
                    <textarea
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      placeholder="Message content..."
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none resize-none h-20"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-white text-xs transition"
                  >
                    Dispatch Broadcast Message
                  </button>
                  {broadcastSuccess && <p className="text-xs text-[#11694A] text-center font-bold animate-pulse">✓ Broadcast notification sent!</p>}
                </form>

                {/* Tuition monthly reminders */}
                <div className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Monthly Fee Reminders Manager</h3>
                    <p className="text-xs text-[#4A5E56] leading-relaxed">
                      Generate monthly tuition billing rows and notify all parents about payment obligations.
                      This generates standard invoices (LKR 5000) for all approved students.
                    </p>
                    <div className="p-3 bg-white text-[#C29A3A] text-xs rounded-xl border border-[#E8E1D0] font-medium">
                      &quot;Treasurer and parent profiles will be updated instantly showing outstanding dues and invoice status.&quot;
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerFeeReminder}
                    className="w-full py-2.5 bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] font-bold rounded-xl text-xs transition"
                  >
                    Dispatch Monthly Fee Reminders
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Tab: Content CMS */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 pb-2 border-b border-[#E8E1D0]">
                {[
                  { id: 'news', en: 'News', ar: 'الأخبار' },
                  { id: 'faculty', en: 'Faculty', ar: 'الأساتذة' },
                  { id: 'curriculum', en: 'Curriculum', ar: 'المنهج' },
                  { id: 'gallery', en: 'Gallery', ar: 'المعرض' },
                  { id: 'courses', en: 'Courses', ar: 'الدورات' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setContentSection(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      contentSection === s.id ? 'bg-[#0B3B2E] text-white' : 'bg-[#FBF8F0] text-[#4A5E56] hover:text-[#0B3B2E] border border-[#E8E1D0]'
                    }`}
                  >
                    {i18n.language === 'ar' ? s.ar : s.en}
                  </button>
                ))}
              </div>
              <AdminContentCMS section={contentSection} />
            </div>
          )}

          {/* Tab 5: Pre-seed student indices */}
          {activeTab === 'indexes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Preseed form */}
                <form onSubmit={handleAddIndexNumber} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3 md:col-span-1">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Add Student Index</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Index Number</label>
                    <input
                      type="text"
                      value={newIndexNumber}
                      onChange={(e) => setNewIndexNumber(e.target.value)}
                      placeholder="e.g., KASHIF-2026-101"
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Student Full Name</label>
                    <input
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Full name..."
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">Class Number</label>
                    <select
                      value={newIndexClass}
                      onChange={(e) => setNewIndexClass(parseInt(e.target.value))}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <option key={num} value={num}>Class {num}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    Seed Index Number
                  </button>
                </form>

                {/* Preseeded Index numbers list */}
                <div className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] md:col-span-2 space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">Pre-registered Index Numbers</h3>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#4A5E56] border-b border-[#E8E1D0]">
                          <th className="py-2 text-left">Index</th>
                          <th className="py-2 text-left">Student Name</th>
                          <th className="py-2 text-center">Class</th>
                          <th className="py-2 text-center">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E1D0] font-mono">
                        {indexList.map(idx => (
                          <tr key={idx.index_number}>
                            <td className="py-2 font-bold text-[#0B3B2E]">{idx.index_number}</td>
                            <td className="py-2 font-sans text-[#14201B]">{idx.student_name}</td>
                            <td className="py-2 text-center text-[#4A5E56]">{idx.class_number}</td>
                            <td className="py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                idx.is_registered ? 'bg-[#E3F1EA] text-[#11694A]' : 'bg-gray-100 text-[#4A5E56]'
                              }`}>
                                {idx.is_registered ? 'YES' : 'NO'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Tab: Analytics */}
          {activeTab === 'analytics' && <AnalyticsDashboard />}

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
