import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import axios from 'axios'

const Contact = () => {
  const { t, i18n } = useTranslation()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      await axios.post('/api/contact', formData)
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: ''
        })
      }, 3000)
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send message')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('contact.title')}</h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'نحن هنا للإجابة على استفساراتك'
              : 'We are here to answer your questions'}
          </p>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-islamic-green mb-6">
                  {i18n.language === 'ar' ? 'معلومات الاتصال' : 'Contact Information'}
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl text-islamic-green">📞</div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-1">
                        {t('contact.phone')}
                      </h3>
                      <p className="text-gray-600">032-5612355</p>
                      <p className="text-gray-600">070-5668463</p>
                      <p className="text-gray-600">071-5576060</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-2xl text-islamic-green">📍</div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-1">
                        {t('contact.address')}
                      </h3>
                      <p className="text-gray-600">Mudalippalli</p>
                      <p className="text-gray-600">Kalpitiya, Puttalam District</p>
                      <p className="text-gray-600">Sri Lanka</p>
                      <p className="text-gray-500 text-sm mt-1">5P2C+VMC</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-2xl text-islamic-green">🌐</div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-1">
                        {i18n.language === 'ar' ? 'وسائل التواصل' : 'Social Media'}
                      </h3>
                      <a
                        href="https://www.facebook.com/100088419063008"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Facebook
                      </a>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Button */}
                <div className="mt-8">
                  <a
                    href="https://wa.me/94705668463"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    {t('contact.whatsapp')}
                  </a>
                </div>
              </div>

              {/* Map */}
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3950.123!2d79.725!3d8.236!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOMKwMTQnMTAuMCJOIDc5wrA0MyczMC4wIkU!5e0!3m2!1sen!2slk!4v1234567890"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="College Location"
                ></iframe>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-islamic-green mb-6">
                  {i18n.language === 'ar' ? 'أرسل لنا رسالة' : 'Send us a Message'}
                </h2>

                {submitted && (
                  <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
                    {i18n.language === 'ar'
                      ? 'شكراً لك! تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.'
                      : 'Thank you! Your message has been sent successfully. We will contact you soon.'}
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      {t('contact.name')} *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        {t('contact.email')} *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        {t('contact.phone')}
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      {t('contact.subject')}
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      {t('contact.message')} *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows="6"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-islamic-green text-white py-3 rounded-lg font-semibold hover:bg-islamic-dark transition-colors"
                  >
                    {t('contact.submit')}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
