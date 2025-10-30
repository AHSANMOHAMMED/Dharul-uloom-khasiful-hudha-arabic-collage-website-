import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const COLORS = ['#0F5132', '#FFD700', '#22c55e', '#ef4444'];

const AdminDashboard = () => {
  const { user, isAdmin, logout } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    try {
      const [statsRes, admissionsRes] = await Promise.all([
        axios.get('/api/admin/stats'),
        axios.get('/api/admin/admissions?status=pending')
      ]);
      setStats(statsRes.data.data);
      setAdmissions(admissionsRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await axios.put(`/api/admin/admissions/${id}`, { status });
      toast.success(`Admission ${status} successfully`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating admission:', error);
      toast.error('Failed to update admission status');
    }
  };

  // Prepare chart data
  const admissionStatusData = stats ? [
    { name: i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending', value: stats.admissions?.pending || 0 },
    { name: i18n.language === 'ar' ? 'تمت الموافقة' : 'Approved', value: stats.admissions?.approved || 0 },
    { name: i18n.language === 'ar' ? 'مرفوض' : 'Rejected', value: stats.admissions?.rejected || 0 },
  ] : [];

  const recentTrendsData = stats?.recentAdmissions?.map((item, index) => ({
    name: `Day ${index + 1}`,
    admissions: 1
  })) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-islamic-green text-white py-4 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {i18n.language === 'ar' ? 'لوحة التحكم' : 'Admin Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <span>{user?.username}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white text-islamic-green rounded-lg hover:bg-gray-100"
            >
              {i18n.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'طلبات القبول' : 'Total Admissions'}
            </h3>
            <p className="text-3xl font-bold text-islamic-green">
              {stats?.admissions?.total || 0}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending'}
            </h3>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.admissions?.pending || 0}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'تمت الموافقة' : 'Approved'}
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {stats?.admissions?.approved || 0}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'الأخبار' : 'News'}
            </h3>
            <p className="text-3xl font-bold text-islamic-green">
              {stats?.content?.news || 0}
            </p>
          </motion.div>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart - Admission Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <h2 className="text-xl font-bold text-islamic-green mb-4">
              {i18n.language === 'ar' ? 'حالة الطلبات' : 'Admission Status'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={admissionStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {admissionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar Chart - Content Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <h2 className="text-xl font-bold text-islamic-green mb-4">
              {i18n.language === 'ar' ? 'نظرة عامة على المحتوى' : 'Content Overview'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: i18n.language === 'ar' ? 'الأخبار' : 'News', count: stats?.content?.news || 0 },
                { name: i18n.language === 'ar' ? 'الأساتذة' : 'Faculty', count: stats?.content?.faculty || 0 },
                { name: i18n.language === 'ar' ? 'الطلبات' : 'Admissions', count: stats?.admissions?.total || 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#0F5132" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <ToastContainer position="top-right" autoClose={3000} />

        {/* Pending Admissions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-islamic-green mb-6">
            {i18n.language === 'ar' ? 'طلبات القبول المعلقة' : 'Pending Admissions'}
          </h2>

          {admissions.length === 0 ? (
            <p className="text-gray-600">
              {i18n.language === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending admissions'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {i18n.language === 'ar' ? 'اسم الطالب' : 'Student Name'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {i18n.language === 'ar' ? 'ولي الأمر' : 'Parent'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {i18n.language === 'ar' ? 'الدورة' : 'Course'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {i18n.language === 'ar' ? 'الإجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admissions.map((admission) => (
                    <tr key={admission._id}>
                      <td className="px-6 py-4 whitespace-nowrap">{admission.studentName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{admission.parentName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{admission.course}</td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleStatusUpdate(admission._id, 'approved')}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {i18n.language === 'ar' ? 'قبول' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(admission._id, 'rejected')}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          {i18n.language === 'ar' ? 'رفض' : 'Reject'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
