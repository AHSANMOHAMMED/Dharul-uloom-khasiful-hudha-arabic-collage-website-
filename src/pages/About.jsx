import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const About = () => {
  const { t, i18n } = useTranslation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-islamic-green text-white py-16 px-4"
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('about.title')}</h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar' 
              ? 'تعرف على رحلتنا ورسالتنا'
              : 'Learn about our journey and mission'}
          </p>
        </div>
      </motion.section>

      {/* Content */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* History */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-white rounded-lg shadow-lg p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-islamic-green mb-4">
              {i18n.language === 'ar' ? 'تاريخنا' : 'Our History'}
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              {i18n.language === 'ar' 
                ? 'تأسست دار العلوم كشف الهدى في عام 2004 كمؤسسة تعليمية عربية أولية في قرية مُدلايبّلّي الريفية، كالبيتيا، مقاطعة بوتالام، سريلانكا. تم تسجيلنا رسميًا في عام 2008 تحت وزارة الشؤون الدينية (رقم التسجيل: MRCA/13/1/PAS/187).'
                : 'Dharul Uloom Kashiful Hudha was established in 2004 as a preliminary Arabic educational institution in the rural village of Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka. We were officially registered in 2008 under the Ministry of Religious Affairs (Registration No: MRCA/13/1/PAS/187).'}
            </p>
            <p className="text-gray-700 leading-relaxed">
              {i18n.language === 'ar'
                ? 'على مدى عقدين من الزمان، كنا نخدم المجتمع الساحلي في كالبيتيا، ونوفر تعليمًا إسلاميًا عالي الجودة للطلاب الصغار.'
                : 'For over two decades, we have been serving the coastal community of Kalpitiya, providing quality Islamic education to young students.'}
            </p>
          </motion.div>

          {/* Mission */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-white rounded-lg shadow-lg p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-islamic-green mb-4">
              {t('about.mission')}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {i18n.language === 'ar'
                ? 'مهمتنا هي رعاية الإيمان والمعرفة من خلال توفير تعليم إسلامي شامل يجمع بين الدراسات الدينية والأكاديمية الأساسية. نسعى جاهدين لتطوير طلاب يتسمون بالأخلاق الحميدة والمعرفة والتفاني في خدمة المجتمع.'
                : 'Our mission is to nurture faith and knowledge by providing comprehensive Islamic education that combines religious studies with basic academics. We strive to develop students who are morally upright, knowledgeable, and dedicated to serving their community.'}
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-white rounded-lg shadow-lg p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-islamic-green mb-4">
              {t('about.vision')}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {i18n.language === 'ar'
                ? 'رؤيتنا هي أن نكون مركزًا رائدًا للتعليم الإسلامي في سريلانكا، معروفًا بالتميز الأكاديمي والتطور الأخلاقي والمشاركة المجتمعية.'
                : 'Our vision is to be a leading center for Islamic education in Sri Lanka, known for academic excellence, moral development, and community engagement.'}
            </p>
          </motion.div>

          {/* Key Information */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-islamic-green text-white rounded-lg shadow-lg p-8"
          >
            <h2 className="text-2xl font-bold mb-6">
              {i18n.language === 'ar' ? 'معلومات أساسية' : 'Key Information'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-islamic-gold mb-2">
                  {i18n.language === 'ar' ? 'تأسست' : 'Established'}
                </h3>
                <p>2004</p>
              </div>
              <div>
                <h3 className="font-semibold text-islamic-gold mb-2">
                  {i18n.language === 'ar' ? 'مسجلة' : 'Registered'}
                </h3>
                <p>February 12, 2008</p>
              </div>
              <div>
                <h3 className="font-semibold text-islamic-gold mb-2">
                  {i18n.language === 'ar' ? 'رقم التسجيل' : 'Registration No'}
                </h3>
                <p>MRCA/13/1/PAS/187</p>
              </div>
              <div>
                <h3 className="font-semibold text-islamic-gold mb-2">
                  {i18n.language === 'ar' ? 'الموقع' : 'Location'}
                </h3>
                <p>Mudalippalli, Kalpitiya</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default About
