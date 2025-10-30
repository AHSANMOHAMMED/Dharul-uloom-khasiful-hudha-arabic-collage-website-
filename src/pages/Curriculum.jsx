import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from 'axios';

const Curriculum = () => {
  const { t, i18n } = useTranslation();
  const [curricula, setCurricula] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurricula();
  }, []);

  const fetchCurricula = async () => {
    try {
      const response = await axios.get('/api/curriculum');
      setCurricula(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching curricula:', error);
      setLoading(false);
    }
  };

  const handleClassClick = (curriculum) => {
    setSelectedClass(selectedClass?.classNumber === curriculum.classNumber ? null : curriculum);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-islamic-green to-islamic-dark text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            {i18n.language === 'ar' ? 'المنهج الدراسي' : '7-Year Curriculum'}
          </motion.h1>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-200"
          >
            {i18n.language === 'ar'
              ? 'برنامج شامل من 7 سنوات للتعليم الإسلامي (الأعمار 5-12)'
              : 'Comprehensive 7-Year Program for Islamic Education (Ages 5-12)'}
          </motion.p>
        </div>
      </section>

      {/* Curriculum Overview */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-islamic-green mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {curricula.map((curriculum, index) => (
                <motion.div
                  key={curriculum._id}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden"
                >
                  {/* Class Header */}
                  <button
                    onClick={() => handleClassClick(curriculum)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-islamic-green text-white rounded-full flex items-center justify-center font-bold text-xl">
                        {curriculum.classNumber}
                      </div>
                      <div className={`text-${i18n.language === 'ar' ? 'right' : 'left'}`}>
                        <h3 className="text-xl font-bold text-islamic-green">
                          {curriculum.className[i18n.language]}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {i18n.language === 'ar' ? 'الأعمار' : 'Ages'}: {curriculum.ageRange.min}-{curriculum.ageRange.max}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-6 h-6 text-gray-400 transition-transform ${
                        selectedClass?.classNumber === curriculum.classNumber ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded Content */}
                  {selectedClass?.classNumber === curriculum.classNumber && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 border-t border-gray-200"
                    >
                      {/* Objectives */}
                      <div className="mt-4 mb-6">
                        <h4 className="font-semibold text-lg mb-2 text-islamic-green">
                          {i18n.language === 'ar' ? 'الأهداف التعليمية' : 'Learning Objectives'}
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                          {curriculum.objectives[i18n.language].map((objective, idx) => (
                            <li key={idx}>{objective}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Modules */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-islamic-green">
                          {i18n.language === 'ar' ? 'الوحدات الدراسية' : 'Modules'}
                        </h4>
                        {curriculum.modules.map((module, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                              <h5 className="font-semibold text-islamic-green">
                                {module.name[i18n.language]}
                              </h5>
                              <div className="flex gap-4 text-sm text-gray-600 mt-2 md:mt-0">
                                <span>
                                  {i18n.language === 'ar' ? 'الساعات' : 'Credits'}: {module.credits}
                                </span>
                                <span>
                                  {i18n.language === 'ar' ? 'ساعات/أسبوع' : 'Hours/Week'}: {module.hoursPerWeek}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 mb-3">
                              {module.description[i18n.language]}
                            </p>
                            
                            {/* Books */}
                            {module.books && module.books.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">
                                  {i18n.language === 'ar' ? 'الكتب المقررة' : 'Assigned Books'}:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {module.books.map((book, bookIdx) => (
                                    <div key={bookIdx} className="bg-white p-2 rounded border border-gray-200">
                                      <p className="text-sm font-semibold text-gray-800">{book.title}</p>
                                      <p className="text-xs text-gray-600">{book.author}</p>
                                      <p className="text-xs text-islamic-green">{book.category}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Assessment Methods */}
                      <div className="mt-6">
                        <h4 className="font-semibold text-lg mb-2 text-islamic-green">
                          {i18n.language === 'ar' ? 'طرق التقييم' : 'Assessment Methods'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {curriculum.assessmentMethods[i18n.language].map((method, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-islamic-green text-white rounded-full text-sm"
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 bg-gradient-to-br from-islamic-green to-islamic-dark text-white p-8 rounded-lg"
          >
            <h3 className="text-2xl font-bold mb-4">
              {i18n.language === 'ar' ? 'عن منهجنا الدراسي' : 'About Our Curriculum'}
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2 text-islamic-gold">
                  {i18n.language === 'ar' ? 'المبادئ الأساسية' : 'Core Principles'}
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>{i18n.language === 'ar' ? 'تعليم تدريجي من الأساس إلى المتقدم' : 'Progressive learning from foundation to advanced'}</li>
                  <li>{i18n.language === 'ar' ? 'التركيز على حفظ القرآن الكريم' : 'Focus on Quran memorization (Hifz)'}</li>
                  <li>{i18n.language === 'ar' ? 'فهم شامل للغة العربية' : 'Comprehensive Arabic language understanding'}</li>
                  <li>{i18n.language === 'ar' ? 'دراسة عميقة للفقه الحنفي' : 'In-depth Hanafi fiqh study'}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-islamic-gold">
                  {i18n.language === 'ar' ? 'المحاذاة الأكاديمية' : 'Academic Alignment'}
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>{i18n.language === 'ar' ? 'منهج درس نظامي التقليدي' : 'Traditional Dars-e-Nizami curriculum'}</li>
                  <li>{i18n.language === 'ar' ? 'معايير وزارة الشؤون الدينية' : 'Ministry of Religious Affairs standards'}</li>
                  <li>{i18n.language === 'ar' ? 'توافق مع SEUSL (جامعة سري لانكا)' : 'SEUSL (Sri Lankan university) alignment'}</li>
                  <li>{i18n.language === 'ar' ? 'نصوص معتمدة من علماء موثوقين' : 'Texts authenticated by trusted scholars'}</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Curriculum;
