import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      "nav.home": "Home",
      "nav.about": "About",
      "nav.courses": "Courses",
      "nav.admissions": "Admissions",
      "nav.faculty": "Faculty",
      "nav.curriculum": "Curriculum",
      "nav.library": "Library",
      "nav.gallery": "Gallery",
      "nav.news": "News",
      "nav.contact": "Contact",
      
      // Home Page
      "home.hero.title": "Welcome to Dharul Uloom Kashiful Hudha",
      "home.hero.subtitle": "Gateway to Islamic Wisdom",
      "home.hero.description": "Nurturing faith and knowledge since 2004 in Kalpitiya, Sri Lanka",
      "home.cta.learn": "Learn More",
      "home.cta.apply": "Apply Now",
      
      // About
      "about.title": "About Us",
      "about.mission": "Our Mission",
      "about.vision": "Our Vision",
      "about.established": "Established in 2004",
      
      // Contact
      "contact.title": "Contact Us",
      "contact.name": "Name",
      "contact.email": "Email",
      "contact.phone": "Phone",
      "contact.subject": "Subject",
      "contact.message": "Message",
      "contact.submit": "Send Message",
      "contact.address": "Address",
      "contact.whatsapp": "Chat on WhatsApp",
      
      // News
      "news.title": "Latest News",
      "news.readMore": "Read More",
      
      // Footer
      "footer.rights": "All rights reserved",
      "footer.follow": "Follow Us",

      // Library
      "library.title": "Digital Islamic Library",
      "library.subtitle": "Browse thousands of books in Tafsir, Hadith, Fiqh, Aqidah and more",
      "library.search": "Search by title, author, or full text...",
      "library.searchBtn": "Search",
      "library.language": "Language",
      "library.category": "Category",
      "library.allLanguages": "All languages",
      "library.allCategories": "All categories",
      "library.noResults": "No matching books.",
      "library.loading": "Loading...",
      "library.backToLibrary": "Back to library"
    }
  },
  ar: {
    translation: {
      // Navigation
      "nav.home": "الرئيسية",
      "nav.about": "عن الكلية",
      "nav.courses": "الدورات",
      "nav.admissions": "القبول",
      "nav.faculty": "الأساتذة",
      "nav.curriculum": "المنهج",
      "nav.library": "المكتبة",
      "nav.gallery": "المعرض",
      "nav.news": "الأخبار",
      "nav.contact": "اتصل بنا",
      
      // Home Page
      "home.hero.title": "مرحبا بكم في دار العلوم كشف الهدى",
      "home.hero.subtitle": "بوابة الحكمة الإسلامية",
      "home.hero.description": "رعاية الإيمان والمعرفة منذ عام 2004 في كالبيتيا، سريلانكا",
      "home.cta.learn": "اعرف المزيد",
      "home.cta.apply": "قدم الآن",
      
      // About
      "about.title": "عن الكلية",
      "about.mission": "مهمتنا",
      "about.vision": "رؤيتنا",
      "about.established": "تأسست في عام 2004",
      
      // Contact
      "contact.title": "اتصل بنا",
      "contact.name": "الاسم",
      "contact.email": "البريد الإلكتروني",
      "contact.phone": "الهاتف",
      "contact.subject": "الموضوع",
      "contact.message": "الرسالة",
      "contact.submit": "إرسال",
      "contact.address": "العنوان",
      "contact.whatsapp": "دردش على واتساب",
      
      // News
      "news.title": "آخر الأخبار",
      "news.readMore": "اقرأ المزيد",
      
      // Footer
      "footer.rights": "جميع الحقوق محفوظة",
      "footer.follow": "تابعنا",

      // Library
      "library.title": "المكتبة الإسلامية الرقمية",
      "library.subtitle": "تصفّح آلاف الكتب في التفسير والحديث والفقه والعقيدة والمزيد",
      "library.search": "ابحث بالعنوان أو المؤلف أو النص الكامل...",
      "library.searchBtn": "بحث",
      "library.language": "اللغة",
      "library.category": "التصنيف",
      "library.allLanguages": "كل اللغات",
      "library.allCategories": "كل التصنيفات",
      "library.noResults": "لا توجد كتب مطابقة.",
      "library.loading": "جارٍ التحميل...",
      "library.backToLibrary": "العودة إلى المكتبة"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
