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
      "nav.academics": "Academics",
      "nav.portal": "Portal",
      "nav.explore": "Explore",
      
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
      "nav.academics": "الدراسة والأكاديمية",
      "nav.portal": "البوابة الإلكترونية",
      "nav.explore": "استكشف",
      
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
  },
  ta: {
    translation: {
      "nav.home": "முகப்பு",
      "nav.about": "எம்மைப் பற்றி",
      "nav.courses": "கற்கைநெறிகள்",
      "nav.admissions": "அனுமதிகள்",
      "nav.faculty": "ஆசிரியர் குழாம்",
      "nav.curriculum": "பாடத்திட்டம்",
      "nav.library": "நூலகம்",
      "nav.gallery": "படத்தொகுப்பு",
      "nav.news": "செய்திகள்",
      "nav.contact": "தொடர்புகொள்ள",
      "nav.academics": "கல்வி",
      "nav.portal": "வலைவாசல்",
      "nav.explore": "ஆராய்க",
      "home.hero.title": "தாருல் உலூம் காஷிஃபுல் ஹுதாவுக்கு வருக",
      "home.hero.subtitle": "இஸ்லாமிய ஞானத்தின் நுழைவாயில்",
      "home.hero.description": "2004 முதல் இலங்கை, கற்பிட்டியில் ஈமானையும் அறிவையும் வளர்த்து வருகிறோம்",
      "home.cta.learn": "மேலும் அறிக",
      "home.cta.apply": "இப்போதே விண்ணப்பியுங்கள்",
      "about.title": "எம்மைப் பற்றி",
      "about.mission": "எமது பணி இலக்கு",
      "about.vision": "எமது தொலைநோக்கு",
      "about.established": "2004 இல் நிறுவப்பட்டது",
      "contact.title": "எம்மைத் தொடர்புகொள்ளுங்கள்",
      "contact.name": "பெயர்",
      "contact.email": "மின்னஞ்சல்",
      "contact.phone": "தொலைபேசி",
      "contact.subject": "விடயம்",
      "contact.message": "செய்தி",
      "contact.submit": "செய்தியை அனுப்பு",
      "contact.address": "முகவரி",
      "contact.whatsapp": "WhatsApp இல் உரையாடுக",
      "news.title": "அண்மைய செய்திகள்",
      "news.readMore": "மேலும் படிக்க",
      "footer.rights": "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை",
      "footer.follow": "எம்மைப் பின்தொடருங்கள்",
      "library.title": "டிஜிட்டல் இஸ்லாமிய நூலகம்",
      "library.subtitle": "தஃப்ஸீர், ஹதீஸ், ஃபிக்ஹ், அகீதா உள்ளிட்ட துறைகளில் ஆயிரக்கணக்கான நூல்களைப் பாருங்கள்",
      "library.search": "தலைப்பு, ஆசிரியர் அல்லது முழு உரை மூலம் தேடுக...",
      "library.searchBtn": "தேடு",
      "library.language": "மொழி",
      "library.category": "பிரிவு",
      "library.allLanguages": "அனைத்து மொழிகளும்",
      "library.allCategories": "அனைத்துப் பிரிவுகளும்",
      "library.noResults": "பொருந்தும் நூல்கள் இல்லை.",
      "library.loading": "ஏற்றுகிறது...",
      "library.backToLibrary": "நூலகத்துக்குத் திரும்பு"
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
