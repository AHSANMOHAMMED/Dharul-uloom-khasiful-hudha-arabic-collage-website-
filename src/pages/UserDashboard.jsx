import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';

const UserDashboard = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [admissions, setAdmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, navigate]);

  const fetchData = async () => {
    try {
      const [admissionsRes, statsRes] = await Promise.all([
        axios.get('/api/user/admissions'),
        axios.get('/api/user/stats')
      ]);
      setAdmissions(admissionsRes.data.data);
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    if (i18n.language === 'ar') {
      return { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' }[status];
    }
    return { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[status];
  };

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
            {i18n.language === 'ar' ? 'لوحة التحكم' : 'My Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-islamic-gold">
              {i18n.language === 'ar' ? 'الصفحة الرئيسية' : 'Home'}
            </Link>
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
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-islamic-green mb-2">
            {i18n.language === 'ar' ? `مرحباً ${user?.username}!` : `Welcome, ${user?.username}!`}
          </h2>
          <p className="text-gray-600">
            {i18n.language === 'ar' 
              ? 'يمكنك متابعة حالة طلبات القبول الخاصة بك من هنا'
              : 'Track your admission applications here'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'إجمالي الطلبات' : 'Total Applications'}
            </h3>
            <p className="text-3xl font-bold text-islamic-green">
              {stats?.total || 0}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-gray-600 text-sm mb-2">
              {i18n.language === 'ar' ? 'قيد المراجعة' : 'Pending'}
            </h3>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.pending || 0}
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
              {stats?.approved || 0}
            </p>
          </motion.div>
        </div>

        {/* Admissions List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-islamic-green">
              {i18n.language === 'ar' ? 'طلبات القبول' : 'My Admissions'}
            </h2>
            <Link
              to="/admissions"
              className="px-4 py-2 bg-islamic-green text-white rounded-lg hover:bg-islamic-dark"
            >
              {i18n.language === 'ar' ? '+ تقديم طلب جديد' : '+ New Application'}
            </Link>
          </div>

          {admissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                {i18n.language === 'ar' 
                  ? 'لم تقدم أي طلبات بعد'
                  : 'You haven\'t submitted any applications yet'}
              </p>
              <Link
                to="/admissions"
                className="text-islamic-green hover:text-islamic-dark font-semibold"
              >
                {i18n.language === 'ar' ? 'قدم طلبك الآن →' : 'Submit your first application →'}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {admissions.map((admission) => (
                <motion.div
                  key={admission._id}
                  whileHover={{ scale: 1.02 }}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {admission.studentName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {i18n.language === 'ar' ? 'الدورة: ' : 'Course: '}
                        {admission.course}
                      </p>
                      <p className="text-sm text-gray-600">
                        {i18n.language === 'ar' ? 'تاريخ التقديم: ' : 'Applied: '}
                        {new Date(admission.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(admission.status)}`}>
                      {getStatusText(admission.status)}
                    </span>
                  </div>
                  {admission.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">
                        <strong>{i18n.language === 'ar' ? 'ملاحظات: ' : 'Notes: '}</strong>
                        {admission.notes}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
