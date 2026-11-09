import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { generateInvoicesInBatches } from '../lib/erp/rpc';
import { adminStats, listAdmissionsByStatus, updateAdmissionStatus } from '../lib/admissionsApi';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminContentCMS from '../components/AdminContentCMS';
import { approveProfile, flushOutbound } from '../lib/notifyApi';
import ImportJobsPanel from '../components/ImportJobsPanel';
import OrgAdminPanel from '../components/OrgAdminPanel';
import { tx } from '../lib/tx';
import { useTabParam } from '../lib/useTabParam';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import { ErpEmbedProvider } from '../context/ErpEmbedContext';
import { PortalNavProvider } from '../context/PortalNavContext';
import { ERP_QUICK_LINK } from '../lib/portalChrome';
import { ROLE_BADGE } from '../lib/roleTheme';

// Full ERP modules — overview tiles open these (not mini previews).
const ErpDashboard = lazy(() => import('../components/erp/campus/ErpDashboard'));
const CrmPanel = lazy(() => import('../components/erp/campus/CrmPanel'));
const StaffHrPanel = lazy(() => import('../components/erp/campus/StaffHrPanel'));
const AnalyticsPanel = lazy(() => import('../components/erp/ops/AnalyticsPanel'));
const FeeManagement = lazy(() => import('../components/erp/finance/FeeManagement'));
const FinanceHubPanel = lazy(() => import('../components/erp/finance/FinanceHubPanel'));
const AccountingPanel = lazy(() => import('../components/erp/finance/AccountingPanel'));
const StudentsPanel = lazy(() => import('../components/erp/campus/StudentsPanel'));
const AcademicsPanel = lazy(() => import('../components/erp/campus/AcademicsPanel'));
const ExpensesPanel = lazy(() => import('../components/erp/finance/ExpensesPanel'));
const DonationsPanel = lazy(() => import('../components/erp/finance/DonationsPanel'));
const PayrollPanel = lazy(() => import('../components/erp/finance/PayrollPanel'));
const WelfarePanel = lazy(() => import('../components/erp/campus/WelfarePanel'));
const HostelPanel = lazy(() => import('../components/erp/campus/HostelPanel'));
const CertificatesPanel = lazy(() => import('../components/erp/campus/CertificatesPanel'));

/** Every ErpDashboard tile module → admin tab id */
const ERP_TILE_TO_TAB = {
  students: 'students',
  hr: 'hrm',
  academics: 'academics',
  fees: 'fees',
  expenses: 'expenses',
  donations: 'donations',
  payroll: 'payroll',
  crm: 'crm',
  welfare: 'welfare',
  hostel: 'hostel',
  certificates: 'certificates',
  accounting: 'accounting',
  financehub: 'financehub',
  analytics: 'analytics',
  financetoday: 'fees',
};

const ADMIN_TABS = [
  'overview', 'admissions', 'crm', 'students', 'academics', 'hrm',
  'fees', 'financehub', 'accounting', 'expenses', 'donations', 'payroll',
  'hostel', 'welfare', 'certificates',
  'imports', 'org', 'approvals', 'tutors', 'broadcast', 'content', 'indexes', 'analytics',
];

function ErpPane({ children }) {
  return (
    <ErpEmbedProvider embedded>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16 text-[#4A5E56] text-xs gap-2">
            <span className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            {tx('جاري التحميل…', 'Loading…')}
          </div>
        }
      >
        {children}
      </Suspense>
    </ErpEmbedProvider>
  );
}

const AdminDashboard = () => {
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  useTranslation();
  const navigate = useNavigate();
  
  // Existing state
  const [stats, setStats] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabParam(ADMIN_TABS, 'overview');
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
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSentCount, setBroadcastSentCount] = useState(0);

  // Index pre-seeding
  const [newIndexNumber, setNewIndexNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newIndexClass, setNewIndexClass] = useState(5);
  const [indexList, setIndexList] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true, state: { from: '/admin' } });
      return;
    }
    // Platform operators use the separate Super Admin console — not the college admin desk.
    if (isSuperAdmin) {
      navigate('/platform', { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchData();
  }, [authLoading, isAdmin, isSuperAdmin, user, navigate]);

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
      toast.error(tx('فشل تحميل بيانات لوحة التحكم', 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateAdmissionStatus(id, status);
      toast.success(status === 'approved'
        ? tx('تمت الموافقة على طلب القبول بنجاح', 'Admission approved successfully')
        : tx('تم رفض طلب القبول بنجاح', 'Admission rejected successfully'));
      fetchData();
    } catch (error) {
      console.error('Error updating admission:', error);
      toast.error(tx('فشل تحديث حالة طلب القبول', 'Failed to update admission status'));
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
          toast.info(tx('تمت الموافقة. لا يوجد ولي أمر مرتبط بعد — اربط ولي أمر ليتلقى تنبيهات التفعيل.', 'Approved. No parent linked yet — attach a parent so they receive activation alerts.'));
        } else {
          toast.success(tx('تمت الموافقة وإشعار أولياء الأمور.', 'Approved and parents notified.'));
        }
      } else {
        toast.success(tx('تمت الموافقة على حساب المستخدم بنجاح!', 'User account approved successfully!'));
      }
      fetchData();
    } catch (err) {
      console.error('Error approving user:', err);
      toast.error(tx('فشلت الموافقة على حساب المستخدم', 'Failed to approve user account'));
    }
  };

  const handleRejectUser = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      toast.success(tx('تم رفض طلب التسجيل وحذف الملف الشخصي.', 'Registration request rejected and profile removed.'));
      fetchData();
    } catch (err) {
      console.error('Error rejecting user:', err);
      toast.error(tx('فشل رفض طلب التسجيل', 'Failed to reject registration request'));
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
        toast.success(tx('تم تحديث دور المعلم بنجاح!', 'Tutor role updated successfully!'));
        fetchData();
        return;
      }
      
      const { error: jobError } = await supabase.from('tutor_jobs').insert({
        tutor_id: selectedTutorId,
        title: assignedRole.toUpperCase(),
        description: `Responsible for college administrative and financial oversight as ${assignedRole}.`
      });

      if (jobError) throw jobError;

      toast.success(tx('تم تحديث دور المعلم بنجاح!', 'Tutor role updated successfully!'));
      fetchData();
    } catch (err) {
      console.error('Error assigning tutor role:', err);
      toast.error(tx('فشل تعيين دور المعلم', 'Failed to assign tutor role'));
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
      toast.success(tx('تم تعيين مسؤولية المعلم بنجاح!', 'Tutor responsibility assigned successfully!'));
      setTimeout(() => setJobSuccess(false), 3500);
      fetchData();
    } catch (err) {
      console.error('Error adding tutor job:', err);
      toast.error(tx('فشل تعيين مهمة المعلم', 'Failed to assign tutor job'));
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
      toast.success(tx('تم التسجيل المسبق لرقم قيد الطالب!', 'Student index number pre-registered!'));
      fetchData();
    } catch (err) {
      console.error('Error adding index number:', err);
      toast.error(tx('فشل إضافة رقم القيد', 'Failed to add index number'));
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim() || broadcastSending) return;

    setBroadcastSending(true);
    try {
      let cursor = null;
      let sent = 0;
      const broadcastId = crypto.randomUUID();
      for (let page = 0; page < 200; page += 1) {
        const { data, error } = await supabase.rpc('send_notification_broadcast', {
          p_broadcast_id: broadcastId,
          p_title: broadcastTitle.trim(),
          p_message: broadcastMsg.trim(),
          p_target: broadcastTarget,
          p_after: cursor,
          p_limit: 150,
        });
        if (error) throw error;
        const count = Number(data?.sent || 0);
        sent += count;
        setBroadcastSentCount(sent);
        if (!data?.has_more || !data?.next_after || data.next_after === cursor) break;
        cursor = data.next_after;
      }

      if (sent > 0) await flushOutbound(100);

      setBroadcastTitle('');
      setBroadcastMsg('');
      setBroadcastSuccess(true);
      toast.success(tx(`تم إدراج الإشعار لـ ${sent} مستخدم`, `Broadcast queued for ${sent} users`));
      setTimeout(() => setBroadcastSuccess(false), 3500);
    } catch (err) {
      console.error('Error sending broadcast:', err);
      toast.error(tx('فشل إرسال البث', 'Failed to dispatch broadcast'));
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleTriggerFeeReminder = async () => {
    try {
      // Generates this month's invoices (fee structures, hostel, concessions) and
      // notifies students + linked parents — idempotent, safe to press twice.
      const monthString = new Date().toISOString().substring(0, 7);
      const result = await generateInvoicesInBatches({ month: monthString });
      if (result?.message) toast.info(result.message);
      toast.success(tx('تم إرسال تذكيرات الرسوم الشهرية بنجاح!', 'Monthly fee reminders dispatched successfully!'));
    } catch (err) {
      console.error('Error triggering fee reminders:', err);
      toast.error(tx('فشل إرسال تذكيرات الرسوم', 'Failed to dispatch fee reminders'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF8F0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#11694A] border-t-transparent animate-spin"></div>
          <p className="text-sm font-sans text-[#4A5E56]">
            {tx('جاري تحميل لوحة الإدارة العامة...', 'Loading central admin console...')}
          </p>
        </div>
      </div>
    );
  }

  const openTab = (id) => {
    if (!ADMIN_TABS.includes(id)) return false;
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  const tabs = [
    { id: 'overview', label_en: 'Overview', label_ar: 'نظرة عامة', icon: 'dashboard' },
    { id: 'admissions', label_en: 'Inquiries', label_ar: 'الطلبات', icon: 'inbox', badge: admissions.length },
    { id: 'crm', label_en: 'CRM Pipeline', label_ar: 'مسار القبول', icon: 'filter_alt' },
    { id: 'students', label_en: 'Students', label_ar: 'الطلاب', icon: 'groups' },
    { id: 'academics', label_en: 'Academics', label_ar: 'الأكاديميات', icon: 'menu_book' },
    { id: 'hrm', label_en: 'Staff HR', label_ar: 'الموارد البشرية', icon: 'badge' },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments' },
    { id: 'financehub', label_en: 'Finance Hub', label_ar: 'مركز المالية', icon: 'hub' },
    { id: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة', icon: 'account_balance' },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'receipt_long' },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism' },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments' },
    { id: 'hostel', label_en: 'Hostel', label_ar: 'السكن', icon: 'apartment' },
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'health_and_safety' },
    { id: 'certificates', label_en: 'Certificates', label_ar: 'الشهادات', icon: 'workspace_premium' },
    { id: 'imports', label_en: 'Shamela Import', label_ar: 'استيراد الشاملة', icon: 'upload_file' },
    { id: 'org', label_en: 'Organization', label_ar: 'المؤسسة', icon: 'corporate_fare' },
    { id: 'approvals', label_en: 'Signups', label_ar: 'الموافقات', icon: 'verified_user', badge: pendingApprovals.length },
    { id: 'tutors', label_en: 'Tutors & Roles', label_ar: 'المعلمون والوظائف', icon: 'school' },
    { id: 'broadcast', label_en: 'Broadcast', label_ar: 'البث', icon: 'campaign' },
    { id: 'content', label_en: 'Content CMS', label_ar: 'إدارة المحتوى', icon: 'post_add' },
    { id: 'indexes', label_en: 'Index Pre-seed', label_ar: 'أرقام القيد', icon: 'pin' },
    { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات', icon: 'analytics' },
  ];

  const portalNav = {
    goTab: (id) => openTab(id),
    goErpModule: (module) => {
      const tab = ERP_TILE_TO_TAB[module];
      if (tab && openTab(tab)) return true;
      navigate(`/erp?module=${encodeURIComponent(module)}`);
      return true;
    },
  };

  return (
    <DashboardSidebarLayout
      title_en={user?.role === 'super_admin' ? 'Super Admin Portal' : 'Admin Portal'}
      title_ar={user?.role === 'super_admin' ? 'بوابة المشرف العام' : 'لوحة الإدارة العامة'}
      roleBadge={{
        text_en: user?.role === 'super_admin' ? 'Super Admin' : 'Admin Console',
        text_ar: user?.role === 'super_admin' ? 'مشرف عام' : 'إدارة الكلية',
        color: ROLE_BADGE.admin,
      }}
      navItems={tabs}
      activeItem={activeTab}
      onSelect={openTab}
      homeItem="overview"
      quickLinks={[
        ERP_QUICK_LINK,
        { to: '/erp?module=financehub', label_en: 'Finance Hub', label_ar: 'مركز المالية', icon: 'hub' },
        { to: '/library-admin', label_en: 'Maktabah Admin', label_ar: 'إدارة المكتبة', icon: 'local_library' },
        { to: '/messages', label_en: 'Messages', label_ar: 'الرسائل', icon: 'chat' },
      ]}
      topActions={
        <button
          onClick={handleTriggerFeeReminder}
          title={tx('إرسال تذكير بالرسوم', 'Trigger Fee Reminders')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E1D0] bg-white text-xs font-semibold text-[#0B3B2E] hover:bg-[#FBF8F0] shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px] text-[#C29A3A]">notifications_active</span>
          <span className="hidden md:inline">{tx('تذكير الرسوم', 'Fee Reminders')}</span>
        </button>
      }
    >
      <PortalNavProvider value={portalNav}>
      <div className="space-y-6">
        <ToastContainer position="top-right" theme="light" autoClose={3000} />

        {/* Retain element anchor for E2E watermark assertion */}
        <div id="admin-khatam" className="hidden" aria-hidden="true"></div>

        {/* Welcome Executive Header — only on overview */}
        {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-7 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#11694A]"></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center font-serif text-2xl font-bold shrink-0 border border-[#11694A]/20">
                إ
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F1EA] text-[#11694A] border border-[#11694A]/20 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#11694A]"></span>
                  {tx('لوحة التحكم الإدارية', 'College Admin Console')}
                </span>
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#0B3B2E]">
                  {tx('مرحباً، {name}', 'Welcome, {name}').replace('{name}', user?.username || tx('المدير', 'Administrator'))}
                </h1>
                <p className="text-xs text-[#4A5E56] font-sans mt-0.5">
                  {tx('اضغط أي مؤشر لفتح الوحدة كاملة.', 'Click any tile to open that full module.')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/erp"
                className="text-xs font-semibold text-emerald-700 border border-[#E8E1D0] rounded-lg px-3 py-1.5 bg-[#FBF8F0] hover:bg-white"
              >
                {tx('فتح ERP الكامل', 'Open full ERP')}
              </Link>
              <span className="text-xs font-semibold text-[#0B3B2E] bg-[#FBF8F0] border border-[#E8E1D0] px-3 py-1.5 rounded-xl">
                {tx('العام الأكاديمي: ٢٠٢٦', 'Academic Year: 2026')}
              </span>
            </div>
          </div>
        </div>
        )}

        {/* KPI Stats Strip — clickable into real modules */}
        {activeTab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label_en: 'Total Students',
              label_ar: 'إجمالي الطلاب',
              value: stats?.users?.students ?? '—',
              icon: 'school',
              color: '#11694A',
              bg: '#E3F1EA',
              tab: 'students',
            },
            {
              label_en: 'Total Tutors',
              label_ar: 'إجمالي المعلمين',
              value: stats?.users?.tutors ?? '—',
              icon: 'person_book',
              color: '#0F7C86',
              bg: '#E0F2F1',
              tab: 'hrm',
            },
            {
              label_en: 'Pending Approvals',
              label_ar: 'بانتظار الموافقة',
              value: pendingApprovals.length,
              icon: 'pending_actions',
              color: pendingApprovals.length > 0 ? '#B91C1C' : '#11694A',
              bg: pendingApprovals.length > 0 ? '#FEE2E2' : '#E3F1EA',
              tab: 'approvals',
            },
            {
              label_en: 'Library Books',
              label_ar: 'الكتب المتاحة',
              value: stats?.library?.books ?? '—',
              icon: 'menu_book',
              color: '#C29A3A',
              bg: '#FEF9EE',
              href: '/library-admin',
            },
          ].map((kpi) => {
            const inner = (
              <>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: kpi.bg, color: kpi.color }}
                >
                  <span className="material-symbols-outlined text-xl">{kpi.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-serif font-bold" style={{ color: kpi.color }}>
                    {kpi.value}
                  </p>
                  <p className="text-[11px] text-[#4A5E56] font-sans truncate">
                    {tx(kpi.label_ar, kpi.label_en)}
                  </p>
                </div>
              </>
            );
            const cls = 'bg-white rounded-2xl border border-[#E8E1D0] p-5 flex items-center gap-4 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] text-start hover:ring-2 hover:ring-emerald-600/40 transition w-full';
            if (kpi.href) {
              return (
                <Link key={kpi.label_en} to={kpi.href} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={kpi.label_en} type="button" className={cls} onClick={() => openTab(kpi.tab)}>
                {inner}
              </button>
            );
          })}
        </div>
        )}

        {/* Overview = live ERP dashboard. Tile clicks open the full module tab (not a preview). */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)]">
            <ErpPane><ErpDashboard /></ErpPane>
          </div>
        )}

        {/* Full feature panels — replace overview when a tab is selected */}
        {activeTab !== 'overview' && (
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] min-h-[480px]">

          {activeTab === 'crm' && <ErpPane><CrmPanel /></ErpPane>}
          {activeTab === 'hrm' && <ErpPane><StaffHrPanel /></ErpPane>}
          {activeTab === 'students' && <ErpPane><StudentsPanel /></ErpPane>}
          {activeTab === 'academics' && <ErpPane><AcademicsPanel /></ErpPane>}
          {activeTab === 'fees' && <ErpPane><FeeManagement embedded /></ErpPane>}
          {activeTab === 'financehub' && <ErpPane><FinanceHubPanel /></ErpPane>}
          {activeTab === 'accounting' && <ErpPane><AccountingPanel /></ErpPane>}
          {activeTab === 'expenses' && <ErpPane><ExpensesPanel /></ErpPane>}
          {activeTab === 'donations' && <ErpPane><DonationsPanel /></ErpPane>}
          {activeTab === 'payroll' && <ErpPane><PayrollPanel /></ErpPane>}
          {activeTab === 'hostel' && <ErpPane><HostelPanel /></ErpPane>}
          {activeTab === 'welfare' && <ErpPane><WelfarePanel /></ErpPane>}
          {activeTab === 'certificates' && <ErpPane><CertificatesPanel /></ErpPane>}

          {activeTab === 'imports' && <ImportJobsPanel />}
          {activeTab === 'org' && <OrgAdminPanel />}

          {/* Tab 1: Admissions Review */}
          {activeTab === 'admissions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('طلبات القبول المعلقة للتحقق', 'Admissions Inquiries Queue')}
              </h2>
              {admissions.length === 0 ? (
                <p className="text-xs text-[#4A5E56] py-12 text-center flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#11694A]">check_circle</span>
                  <span>{tx('لا توجد طلبات قبول معلقة حالياً.', 'No pending admissions inquiries.')}</span>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                        <th className="py-2.5 px-4">{tx('اسم الطالب', 'Student')}</th>
                        <th className="py-2.5 px-4">{tx('ولي الأمر', 'Parent')}</th>
                        <th className="py-2.5 px-4">{tx('الدورة', 'Course')}</th>
                        <th className="py-2.5 px-4 text-center">{tx('الإجراء', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E1D0]">
                      {admissions.map((admission) => (
                        <tr key={admission._id} className="hover:bg-[#FBF8F0] transition">
                          <td className="py-3 px-4 font-bold text-[#0B3B2E]">
                            {admission.studentName}
                            {(admission.dateOfBirth || admission.age != null) && (
                              <div className="text-[11px] font-normal text-[#4A5E56] mt-0.5">
                                {[admission.dateOfBirth, admission.age != null ? `${tx('العمر', 'Age')}: ${admission.age}` : null].filter(Boolean).join(' · ')}
                                {admission.source ? ` · ${tx('المصدر', 'Source')}: ${admission.source}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#4A5E56]">{admission.parentName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#11694A] uppercase">{admission.course}</td>
                          <td className="py-3 px-4 text-center space-x-2">
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'approved')}
                              className="px-3 py-1 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-lg text-[11px] transition"
                            >
                              {tx('موافقة', 'Approve')}
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(admission._id, 'rejected')}
                              className="px-3 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-bold rounded-lg text-[11px] transition"
                            >
                              {tx('رفض', 'Reject')}
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
                {tx('الموافقات على تسجيل الطلاب والمعلمين', 'User Signup Approvals Queue')}
              </h2>
              {pendingApprovals.length === 0 ? (
                <p className="text-xs text-[#4A5E56] py-12 text-center flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#11694A]">check_circle</span>
                  <span>{tx('لا يوجد مستخدمون في قائمة الانتظار.', 'No users waiting in the approval queue.')}</span>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#4A5E56] font-bold uppercase tracking-wider border-b border-[#E8E1D0]">
                        <th className="py-2.5 px-4">{tx('الاسم', 'Name')}</th>
                        <th className="py-2.5 px-4">{tx('البريد الإلكتروني', 'Email')}</th>
                        <th className="py-2.5 px-4">{tx('نوع الدور', 'Role Type')}</th>
                        <th className="py-2.5 px-4">{tx('تفاصيل القيد', 'Index Details')}</th>
                        <th className="py-2.5 px-4 text-center">{tx('الإجراء', 'Actions')}</th>
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
                              {profile.account_type === 'tutor' ? tx('معلم', 'Tutor') : tx('طالب', 'Student')}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#4A5E56]">{profile.index_number || tx('غير متوفر', 'N/A')}</td>
                          <td className="py-3 px-4 text-center space-x-2">
                            <button
                              onClick={() => handleApproveUser(profile.id)}
                              className="px-3 py-1 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-lg text-[11px] transition"
                            >
                              {tx('موافقة', 'Approve')}
                            </button>
                            <button
                              onClick={() => handleRejectUser(profile.id)}
                              className="px-3 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-bold rounded-lg text-[11px] transition"
                            >
                              {tx('رفض', 'Reject')}
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
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('تعيين دور إداري خاص', 'Assign Special Administrative Role')}</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('اختر عضو هيئة التدريس', 'Select Faculty Member')}</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">{tx('-- اختر المعلم --', '-- Choose Tutor --')}</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name} ({t.assigned_tutor_role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('الدور المعين', 'Designated Role')}</label>
                    <select
                      value={assignedRole}
                      onChange={(e) => setAssignedRole(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                    >
                      <option value="none">{tx('لا شيء (معلم عادي)', 'NONE (Regular Tutor)')}</option>
                      <option value="principal">{tx('المدير', 'PRINCIPAL')}</option>
                      <option value="vice_principal">{tx('نائب المدير', 'VICE PRINCIPAL')}</option>
                      <option value="treasurer">{tx('أمين الصندوق (المدقق المالي)', 'TREASURER (Financial Auditor)')}</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    {tx('تحديث تكليف المعلم', 'Update Tutor Assignment')}
                  </button>
                </form>

                {/* Annual Responsibility Job */}
                <form onSubmit={handleAddTutorJob} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('تعيين مسؤولية وظيفية سنوية', 'Assign Annual Job Responsibility')}</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('اختر المعلم', 'Select Tutor')}</label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none"
                      required
                    >
                      <option value="">{tx('-- اختر المعلم --', '-- Choose Tutor --')}</option>
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('المسمى الوظيفي', 'Job Title')}</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder={tx('مثال: مربي الصف الخامس، عميد الدراسات القرآنية', 'e.g. Class 5 Master, Dean of Quranic Studies')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('نطاق المهمة', 'Job Scope')}</label>
                    <textarea
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      placeholder={tx('المهام السنوية...', 'Annual duties...')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none resize-none h-14"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    {tx('تعيين المهمة السنوية', 'Assign Annual Job')}
                  </button>
                  {jobSuccess && (
                    <p className="text-xs text-[#11694A] text-center font-bold animate-pulse flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>{tx('تم تحديث المسؤولية بنجاح!', 'Responsibility updated successfully!')}</span>
                    </p>
                  )}
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
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('إنشاء إشعار بث', 'Compose Broadcast Notification')}</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('الجمهور المستهدف', 'Target Audience')}</label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                    >
                      <option value="all">{tx('جميع المستخدمين', 'ALL USERS')}</option>
                      <option value="students">{tx('الطلاب فقط', 'STUDENTS ONLY')}</option>
                      <option value="parents">{tx('أولياء الأمور فقط', 'PARENTS ONLY')}</option>
                      <option value="tutors">{tx('المعلمون فقط', 'TUTORS ONLY')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('عنوان البث', 'Broadcast Title')}</label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder={tx('عنوان الإشعار...', 'Notification title...')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('الرسالة', 'Message')}</label>
                    <textarea
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      placeholder={tx('محتوى الرسالة...', 'Message content...')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] rounded-xl p-2.5 focus:outline-none resize-none h-20"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={broadcastSending}
                    className="w-full py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-white text-xs transition disabled:opacity-50"
                  >
                    {broadcastSending ? tx(`جارٍ الإرسال... ${broadcastSentCount}`, `Sending... ${broadcastSentCount}`) : tx('إرسال رسالة البث', 'Dispatch Broadcast Message')}
                  </button>
                  {broadcastSuccess && <p className="text-xs text-[#11694A] text-center font-bold animate-pulse">✓ {tx(`تم إدراج الإشعار لـ ${broadcastSentCount} مستخدم`, `Broadcast queued for ${broadcastSentCount} users`)}</p>}
                </form>

                {/* Tuition monthly reminders */}
                <div className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('إدارة تذكيرات الرسوم الشهرية', 'Monthly Fee Reminders Manager')}</h3>
                    <p className="text-xs text-[#4A5E56] leading-relaxed">
                      {tx('إنشاء فواتير الشهر الحالي (هياكل الرسوم، السكن، الإعفاءات) وإشعار الطلاب وأولياء الأمور المرتبطين بالتزامات الدفع.', 'Generate this month\'s invoices (fee structures, hostel, concessions) and notify students and linked parents about payment obligations.')}{' '}
                      {tx('العملية آمنة للتكرار — لا تُنشأ فواتير مكررة.', 'Safe to run twice — no duplicate invoices are created.')}
                    </p>
                    <div className="p-3 bg-white text-[#C29A3A] text-xs rounded-xl border border-[#E8E1D0] font-medium">
                      &quot;{tx('سيتم تحديث ملفات أمين الصندوق وأولياء الأمور فوراً لعرض المستحقات وحالة الفواتير.', 'Treasurer and parent profiles will be updated instantly showing outstanding dues and invoice status.')}&quot;
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerFeeReminder}
                    className="w-full py-2.5 bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] font-bold rounded-xl text-xs transition"
                  >
                    {tx('إرسال تذكيرات الرسوم الشهرية', 'Dispatch Monthly Fee Reminders')}
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
                    {tx(s.ar, s.en)}
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
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('إضافة قيد طالب', 'Add Student Index')}</h3>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('رقم القيد', 'Index Number')}</label>
                    <input
                      type="text"
                      value={newIndexNumber}
                      onChange={(e) => setNewIndexNumber(e.target.value)}
                      placeholder={tx('مثال: KASHIF-2026-101', 'e.g., KASHIF-2026-101')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('الاسم الكامل للطالب', 'Student Full Name')}</label>
                    <input
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder={tx('الاسم الكامل...', 'Full name...')}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider mb-1">{tx('رقم الصف', 'Class Number')}</label>
                    <select
                      value={newIndexClass}
                      onChange={(e) => setNewIndexClass(parseInt(e.target.value))}
                      className="w-full bg-white border border-[#E8E1D0] text-xs text-[#14201B] p-2.5 rounded-xl focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <option key={num} value={num}>{tx('الصف {n}', 'Class {n}').replace('{n}', num)}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] font-bold rounded-xl text-xs text-white transition"
                  >
                    {tx('إضافة رقم القيد', 'Seed Index Number')}
                  </button>
                </form>

                {/* Preseeded Index numbers list */}
                <div className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] md:col-span-2 space-y-3">
                  <h3 className="font-serif font-bold text-[#0B3B2E] text-base">{tx('أرقام القيد المسجلة مسبقاً', 'Pre-registered Index Numbers')}</h3>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#4A5E56] border-b border-[#E8E1D0]">
                          <th className="py-2 text-left">{tx('القيد', 'Index')}</th>
                          <th className="py-2 text-left">{tx('اسم الطالب', 'Student Name')}</th>
                          <th className="py-2 text-center">{tx('الصف', 'Class')}</th>
                          <th className="py-2 text-center">{tx('مسجل', 'Registered')}</th>
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
                                {idx.is_registered ? tx('نعم', 'YES') : tx('لا', 'NO')}
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
          {activeTab === 'analytics' && <ErpPane><AnalyticsPanel /></ErpPane>}

        </div>
        )}
      </div>
      </PortalNavProvider>
    </DashboardSidebarLayout>
  );
};

export default AdminDashboard;
