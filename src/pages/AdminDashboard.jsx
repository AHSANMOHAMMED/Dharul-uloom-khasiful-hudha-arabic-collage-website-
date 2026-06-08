import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { adminStats, listAdmissionsByStatus, updateAdmissionStatus } from '../lib/admissionsApi';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AnalyticsDashboard from './AnalyticsDashboard';
import AdminContentCMS from '../components/AdminContentCMS';

const COLORS = ['#059669', '#d97706', '#2563eb', '#dc2626'];

const AdminDashboard = () => {
  const { user, isAdmin, logout, loading: authLoading } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  
  // Existing state
  const [stats, setStats] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admissions');
  const [contentSection, setContentSection] = useState('news');

  // New state for approvals queue
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  // New state for tutors role manager
  const [tutors, setTutors] = useState([]);
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [assignedRole, setAssignedRole] = useState('none');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobSuccess, setJobSuccess] = useState(false);

  // New state for Broadcast tool
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Index pre-seeding helper state
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

      // Fetch pending approvals (students & tutors with is_approved = false)
      const { data: approvalsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .in('account_type', ['student', 'tutor'])
        .order('created_at', { ascending: false });
      setPendingApprovals(approvalsData || []);

      // Fetch approved tutors for role manager
      const { data: tutorsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_type', 'tutor')
        .eq('is_approved', true)
        .order('full_name');
      setTutors(tutorsData || []);

      // Fetch valid index list
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
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating admission:', error);
      toast.error('Failed to update admission status');
    }
  };

  // User approval handlers
  const handleApproveUser = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', profileId);

      if (error) throw error;
      toast.success('User account approved successfully!');
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

  // Role Assignment
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
      
      // Auto Assign standard jobs if Principal/Treasurer
      const { error: jobError } = await supabase.from('tutor_jobs').insert({
        tutor_id: selectedTutorId,
        title: assignedRole.toUpperCase(),
        description: `Responsible for college administrative and financial oversight as ${assignedRole}.`
      });

      if (jobError) {
        throw jobError;
      }

      toast.success('Tutor role updated successfully!');
      fetchData();
    } catch (err) {
      console.error('Error assigning tutor role:', err);
      toast.error('Failed to assign tutor role');
    }
  };

  // Add annual tutor job responsibility
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
      setTimeout(() => setJobSuccess(false), 3000);
      fetchData();
    } catch (err) {
      console.error('Error adding tutor job:', err);
      toast.error('Failed to assign tutor job');
    }
  };

  // Seed valid student index numbers
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
      toast.success('Student index number pre-registered!');
      fetchData();
    } catch (err) {
      console.error('Error adding index:', err);
      toast.error('Failed to add index number');
    }
  };

  // Broadcast tool
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;

    try {
      // Fetch target profiles
      let query = supabase.from('profiles').select('id');
      if (broadcastTarget === 'students') {
        query = query.eq('account_type', 'student');
      } else if (broadcastTarget === 'parents') {
        query = query.eq('account_type', 'parent');
      } else if (broadcastTarget === 'tutors') {
        query = query.eq('account_type', 'tutor');
      }
      
      const { data: targets, error } = await query;
      if (error) throw error;
      if (targets && targets.length > 0) {
        const notificationsPayload = targets.map(t => ({
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
      toast.success('Bilingual Broadcast notification sent successfully!');
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch (err) {
      console.error('Error sending broadcast:', err);
      toast.error('Failed to dispatch broadcast');
    }
  };

  // Send tuition fee reminder trigger
  const handleTriggerFeeReminder = async () => {
    try {
      // Find all approved students
      const { data: studentsList, error } = await supabase
        .from('profiles')
        .select('id, full_name, parent_children(parent_id)')
        .eq('account_type', 'student')
        .eq('is_approved', true);
      if (error) throw error;

      if (studentsList && studentsList.length > 0) {
        const monthString = new Date().toISOString().substring(0, 7); // e.g. '2026-06'
        
        for (const student of studentsList) {
          // Initialize fee row if not exists
          await supabase
            .from('student_fees')
            .insert({
              student_id: student.id,
              month: monthString,
              total_due: 5000.00
            })
            .onConflict('student_id, month')
            .ignore();

          // Notify parents
          const parentId = student.parent_children?.[0]?.parent_id;
          if (parentId) {
            const { error: notificationError } = await supabase.from('notifications').insert({
              user_id: parentId,
              title: 'Monthly Tuition Fee Reminder',
              message: `Reminder: Tuition fee of LKR 5000 is generated for your child ${student.full_name} for ${monthString}.`
            });
            if (notificationError) throw notificationError;
          }
        }
      }
      toast.success('Monthly fee reminders dispatched successfully!');
    } catch (err) {
      console.error('Error triggering fee reminders:', err);
      toast.error('Failed to dispatch fee reminders');
    }
  };

  const admissionStatusData = stats ? [
    { name: i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending', value: stats.admissions?.pending || 0 },
    { name: i18n.language === 'ar' ? 'تمت الموافقة' : 'Approved', value: stats.admissions?.approved || 0 },
    { name: i18n.language === 'ar' ? 'مرفوض' : 'Rejected', value: stats.admissions?.rejected || 0 },
  ] : [];

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
    <div className="min-h-screen bg-gray-950 text-gray-100 relative overflow-hidden">
      
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-amber-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <div className="glass-panel border-b border-gray-800/60 text-white py-5 px-6 shadow-glass relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-glow-emerald">
              <span className="text-white text-xl">🛡️</span>
            </div>
            <div>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black font-mono tracking-widest uppercase shadow-glow-emerald">ADMIN SYSTEM</span>
              <h1 className="text-2xl font-extrabold mt-1.5 font-arabic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                {i18n.language === 'ar' ? 'الإدارة المركزية والتحكم' : 'Central Admin Console'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white">{user?.username}</div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-widest">Super Administrator</div>
            </div>
            <button
              onClick={logout}
              className="px-5 py-2.5 bg-gray-900/80 hover:bg-red-900/40 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-500/50 rounded-xl font-bold text-sm transition-all shadow-lg hover:-translate-y-0.5"
            >
              {i18n.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
        
        {/* Charts & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          <div className="glass-card p-6 rounded-[2rem] group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                📊
              </div>
              <h2 className="text-lg font-bold text-white">
                {i18n.language === 'ar' ? 'تحليلات طلبات القبول' : 'Admission Funnel'}
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={admissionStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={5}
                >
                  {admissionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 rounded-[2rem] group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                📈
              </div>
              <h2 className="text-lg font-bold text-white">
                {i18n.language === 'ar' ? 'المحتوى والإحصائيات العامة' : 'Database Analytics'}
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { name: i18n.language === 'ar' ? 'الأخبار' : 'News', count: stats?.content?.news || 0 },
                { name: i18n.language === 'ar' ? 'الأساتذة' : 'Faculty', count: stats?.content?.faculty || 0 },
                { name: i18n.language === 'ar' ? 'الطلبات' : 'Admissions', count: stats?.admissions?.total || 0 },
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{fill: '#9ca3af', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#9ca3af" tick={{fill: '#9ca3af', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="count" fill="url(#colorEmerald)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                <defs>
                  <linearGradient id="colorEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="glass-panel p-2 rounded-2xl flex overflow-x-auto gap-2 relative z-10 hide-scrollbar border border-gray-800/60 shadow-lg">
          {[
            { id: 'admissions', label_en: 'Admissions', label_ar: 'طلبات القبول', icon: '📝' },
            { id: 'approvals', label_en: 'Signups', label_ar: 'الموافقات', icon: '🔐' },
            { id: 'tutors', label_en: 'Tutors & Roles', label_ar: 'المعلمون والوظائف', icon: '👨‍🏫' },
            { id: 'broadcast', label_en: 'Broadcast', label_ar: 'البث', icon: '📢' },
            { id: 'content', label_en: 'Content CMS', label_ar: 'إدارة المحتوى', icon: '📰' },
            { id: 'indexes', label_en: 'Index Pre-seed', label_ar: 'أرقام القيد', icon: '🪪' },
            { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات', icon: '📊' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-glow-emerald border border-emerald-400/20'
                  : 'bg-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {i18n.language === 'ar' ? tab.label_ar : tab.label_en}
            </button>
          ))}
        </div>

        <ToastContainer position="top-right" theme="dark" autoClose={3000} />

        {/* Dynamic Panels */}
        <div className="glass-card rounded-[2rem] p-8 shadow-2xl relative z-10 min-h-[500px]">
          
          {/* Tab 1: Admissions Review */}
          {activeTab === 'admissions' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white font-arabic">
                {i18n.language === 'ar' ? 'طلبات القبول المعلقة للتحقق' : 'Admissions Inquiries Queue'}
              </h2>
              {admissions.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No pending admissions inquiries.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="px-6 py-3 text-left font-semibold">Student</th>
                        <th className="px-6 py-3 text-left font-semibold">Parent</th>
                        <th className="px-6 py-3 text-left font-semibold">Course</th>
                        <th className="px-6 py-3 text-left font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-gray-300">
                      {admissions.map((admission) => (
                        <tr key={admission._id} className="hover:bg-gray-850/10">
                          <td className="px-6 py-4 font-semibold text-white">{admission.studentName}</td>
                          <td className="px-6 py-4">{admission.parentName}</td>
                          <td className="px-6 py-4 uppercase font-bold text-xs text-amber-500">{admission.course}</td>
                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'approved')}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 font-bold rounded text-xs text-white"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'rejected')}
                              className="px-3 py-1.5 bg-red-700 hover:bg-red-650 font-bold rounded text-xs text-white"
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
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white font-arabic">
                {i18n.language === 'ar' ? 'الموافقات على تسجيل الطلاب والمعلمين' : 'User Signup Approvals Queue'}
              </h2>
              {pendingApprovals.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No users waiting in the approval queue.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="px-6 py-3 text-left font-semibold">Name</th>
                        <th className="px-6 py-3 text-left font-semibold">Email</th>
                        <th className="px-6 py-3 text-left font-semibold">Role Type</th>
                        <th className="px-6 py-3 text-left font-semibold">Index Details</th>
                        <th className="px-6 py-3 text-left font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-gray-300">
                      {pendingApprovals.map((profile) => (
                        <tr key={profile.id} className="hover:bg-gray-850/10">
                          <td className="px-6 py-4 font-semibold text-white">{profile.full_name}</td>
                          <td className="px-6 py-4 font-mono">{profile.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              profile.account_type === 'tutor' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {profile.account_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-400">{profile.index_number || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleApproveUser(profile.id)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-650 font-bold rounded text-xs text-white"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectUser(profile.id)}
                              className="px-3 py-1.5 bg-red-700 hover:bg-red-650 font-bold rounded text-xs text-white"
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
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Assign Special Role (Treasurer, Principal) */}
                <form onSubmit={handleAssignTutorRole} className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 space-y-4">
                  <h3 className="text-lg font-bold text-white">Assign Tutor Special Role</h3>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Select Teacher</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Tutor --</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name} ({t.assigned_tutor_role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Select Special Assignment</label>
                    <select
                      value={assignedRole}
                      onChange={(e) => setAssignedRole(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2.5 focus:outline-none"
                    >
                      <option value="none">NONE (Regular Tutor)</option>
                      <option value="principal">PRINCIPAL</option>
                      <option value="vice_principal">VICE PRINCIPAL</option>
                      <option value="treasurer">TREASURER (Financial Auditor)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-650 font-bold rounded text-sm text-white"
                  >
                    Update Tutor Assignment
                  </button>
                </form>

                {/* Create Tutor annual responsibility job */}
                <form onSubmit={handleAddTutorJob} className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 space-y-4">
                  <h3 className="text-lg font-bold text-white">Create Annual Responsibility Job</h3>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Select Tutor</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Tutor --</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Job Title / Assignment</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Class 5 Class-Teacher, Head of Quran Dept"
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Job Description</label>
                    <textarea
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      placeholder="Annual duties..."
                      className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded p-2.5 focus:outline-none resize-none h-16"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-650 font-bold rounded text-sm text-white"
                  >
                    Assign Annual Job
                  </button>
                  {jobSuccess && <p className="text-xs text-emerald-400 text-center animate-pulse">✓ Responsibility updated successfully!</p>}
                </form>

              </div>
            </div>
          )}

          {/* Tab 4: Broadcast alerts & reminders */}
          {activeTab === 'broadcast' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Compose Broadcast Notification */}
                <form onSubmit={handleSendBroadcast} className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 space-y-4">
                  <h3 className="text-lg font-bold text-white">Compose Broadcast Notification</h3>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Target Audience</label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                    >
                      <option value="all">ALL USERS</option>
                      <option value="students">STUDENTS ONLY</option>
                      <option value="parents">PARENTS ONLY</option>
                      <option value="tutors">TUTORS ONLY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Broadcast Title</label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="Notification title..."
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Bilingual Message</label>
                    <textarea
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      placeholder="Message content in English and Arabic..."
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded p-2.5 focus:outline-none resize-none h-24"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-650 font-bold rounded-xl text-white text-sm transition"
                  >
                    Dispatch Broadcast Message
                  </button>
                  {broadcastSuccess && <p className="text-xs text-emerald-400 text-center animate-pulse">✓ Broadcast notification sent!</p>}
                </form>

                {/* Tuition monthly reminders */}
                <div className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Monthly Fee Reminders Manager</h3>
                    <p className="text-xs text-gray-400">
                      Generate monthly tuition billing rows and notify all parents about payment obligations.
                      This generates standard invoices (LKR 5000) for all approved students.
                    </p>
                    <div className="p-4 bg-amber-500/10 text-amber-300 text-xs rounded-lg border border-amber-500/20 italic">
                      &quot;Treasurer and parent profiles will be updated instantly showing outstanding dues and invoice status.&quot;
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerFeeReminder}
                    className="w-full mt-6 py-3 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-xl text-sm transition"
                  >
                    🔔 Dispatch Monthly Fee Reminders
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Tab: Content CMS */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
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
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                      contentSection === s.id ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
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
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Preseed form */}
                <form onSubmit={handleAddIndexNumber} className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 space-y-4 md:col-span-1">
                  <h3 className="text-lg font-bold text-white">Add Student Index</h3>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Index Number</label>
                    <input
                      type="text"
                      value={newIndexNumber}
                      onChange={(e) => setNewIndexNumber(e.target.value)}
                      placeholder="e.g., KASHIF-2026-101"
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Student Full Name</label>
                    <input
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Full name..."
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Class Number</label>
                    <select
                      value={newIndexClass}
                      onChange={(e) => setNewIndexClass(parseInt(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <option key={num} value={num}>Class {num}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-650 font-bold rounded text-sm text-white"
                  >
                    Seed Index Number
                  </button>
                </form>

                {/* Preseeded Index numbers list */}
                <div className="bg-gray-950/40 p-6 rounded-xl border border-gray-800 md:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-white">Pre-registered Index Numbers</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-800 text-xs text-gray-300">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="py-2 text-left">Index</th>
                          <th className="py-2 text-left">Student Name</th>
                          <th className="py-2 text-center">Class</th>
                          <th className="py-2 text-center">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40 font-mono">
                        {indexList.map(idx => (
                          <tr key={idx.index_number}>
                            <td className="py-3 font-semibold text-white">{idx.index_number}</td>
                            <td className="py-3 font-sans">{idx.student_name}</td>
                            <td className="py-3 text-center">{idx.class_number}</td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                idx.is_registered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-850 text-gray-500'
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
          {activeTab === 'analytics' && (
            <AnalyticsDashboard />
          )}

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
