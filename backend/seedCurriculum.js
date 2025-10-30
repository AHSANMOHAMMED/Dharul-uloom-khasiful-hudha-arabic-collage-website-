import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Book from './models/Book.js';
import Curriculum from './models/Curriculum.js';

dotenv.config();

const books = [
  // Quran & Recitation (Classes 1-3)
  {
    title: 'Noorani Qaida',
    author: 'Maulana Noor Muhammad',
    category: 'Arabic Grammar',
    description: {
      en: 'Foundational book for learning Arabic alphabet and Quran recitation basics',
      ar: 'كتاب أساسي لتعلم الأبجدية العربية وأساسيات تلاوة القرآن'
    },
    coverUrl: '/images/books/noorani-qaida.jpg',
    pdfUrl: 'https://archive.org/download/noorani-qaida/noorani-qaida.pdf',
    year: 2000,
    language: ['Arabic', 'Urdu'],
    publisher: 'Darussalam',
    assignedToClasses: [1]
  },
  {
    title: 'Ahsan al-Qawa\'id (Lessons 1-24)',
    author: 'Maulana Ashraf Ali Thanvi',
    category: 'Arabic Grammar',
    description: {
      en: 'Complete guide for learning Quranic recitation rules and Arabic basics',
      ar: 'دليل كامل لتعلم قواعد تلاوة القرآن وأساسيات اللغة العربية'
    },
    coverUrl: '/images/books/ahsan-qawaid.jpg',
    pdfUrl: 'https://archive.org/download/ahsan-qawaid/ahsan-qawaid.pdf',
    year: 2005,
    language: ['Arabic', 'Urdu'],
    publisher: 'Safar Publications',
    assignedToClasses: [1, 2, 3]
  },
  
  // Tafsir (Classes 5-7)
  {
    title: 'Tafsir Jalalayn',
    author: 'Jalal al-Din al-Mahalli & Jalal al-Din al-Suyuti',
    category: 'Tafsir',
    description: {
      en: 'Classical and concise commentary on the entire Quran, essential for intermediate students',
      ar: 'تفسير كلاسيكي وموجز للقرآن الكريم كاملاً، ضروري للطلاب المتوسطين'
    },
    coverUrl: '/images/books/tafsir-jalalayn.jpg',
    pdfUrl: 'https://shamela.ws/book/12345',
    year: 1505,
    language: ['Arabic'],
    publisher: 'Dar al-Kutub al-Ilmiyah',
    pages: 800,
    assignedToClasses: [6, 7]
  },
  {
    title: 'Jami\' al-Bayan (Tafsir al-Tabari)',
    author: 'Muhammad ibn Jarir al-Tabari',
    category: 'Tafsir',
    description: {
      en: 'Comprehensive classical Quranic commentary, one of the most authoritative works',
      ar: 'تفسير قرآني كلاسيكي شامل، من أهم المراجع الموثوقة'
    },
    coverUrl: '/images/books/tafsir-tabari.jpg',
    pdfUrl: 'https://archive.org/download/tafsir-tabari/tabari-tafsir.pdf',
    year: 923,
    language: ['Arabic'],
    publisher: 'Dar al-Fikr',
    pages: 12000,
    assignedToClasses: [7]
  },
  {
    title: 'Tafsir Ibn Kathir',
    author: 'Ismail ibn Umar ibn Kathir',
    category: 'Tafsir',
    description: {
      en: 'Popular Quranic commentary known for its clarity and reliance on hadith',
      ar: 'تفسير قرآني مشهور معروف بوضوحه واعتماده على الأحاdiث'
    },
    coverUrl: '/images/books/tafsir-ibn-kathir.jpg',
    pdfUrl: 'https://archive.org/download/tafsir-ibn-kathir/ibn-kathir.pdf',
    year: 1373,
    language: ['Arabic', 'Urdu'],
    publisher: 'Darussalam',
    pages: 5000,
    assignedToClasses: [6, 7]
  },
  
  // Hadith (Classes 5-7)
  {
    title: 'Sahih al-Bukhari',
    author: 'Muhammad ibn Ismail al-Bukhari',
    category: 'Hadith',
    description: {
      en: 'The most authentic collection of Prophet Muhammad\'s sayings and actions',
      ar: 'أصح مجموعة من أقوال وأفعال النبي محمد صلى الله عليه وسلم'
    },
    coverUrl: '/images/books/sahih-bukhari.jpg',
    pdfUrl: 'https://archive.org/download/sahih-bukhari/bukhari-full.pdf',
    year: 846,
    language: ['Arabic'],
    publisher: 'Dar al-Salam',
    pages: 3000,
    assignedToClasses: [7]
  },
  {
    title: 'Sahih Muslim',
    author: 'Muslim ibn al-Hajjaj',
    category: 'Hadith',
    description: {
      en: 'Second most authentic hadith collection after Sahih al-Bukhari',
      ar: 'ثاني أصح مجموعة أحاديث بعد صحيح البخاري'
    },
    coverUrl: '/images/books/sahih-muslim.jpg',
    pdfUrl: 'https://shamela.ws/book/67890',
    year: 875,
    language: ['Arabic'],
    publisher: 'Dar Ihya al-Turath',
    pages: 2800,
    assignedToClasses: [7]
  },
  {
    title: 'Riyad as-Salihin',
    author: 'Imam Nawawi',
    category: 'Hadith',
    description: {
      en: 'Gardens of the Righteous - compilation of hadith on ethics and daily life',
      ar: 'رياض الصالحين - مجموعة أحاديث عن الأخلاق والحياة اليومية'
    },
    coverUrl: '/images/books/riyad-salihin.jpg',
    pdfUrl: 'https://kitaabun.com/riyad-salihin.pdf',
    year: 1270,
    language: ['Arabic', 'Urdu', 'English'],
    publisher: 'Darussalam',
    pages: 500,
    assignedToClasses: [5, 6]
  },
  {
    title: 'Al-Muwatta',
    author: 'Imam Malik ibn Anas',
    category: 'Hadith',
    description: {
      en: 'Early collection of hadith and fiqh, foundational text in Islamic jurisprudence',
      ar: 'مجموعة مبكرة من الأحاديث والفقه، نص أساسي في الفقه الإسلامي'
    },
    coverUrl: '/images/books/muwatta.jpg',
    pdfUrl: 'https://archive.org/download/muwatta-malik/muwatta.pdf',
    year: 795,
    language: ['Arabic'],
    publisher: 'Dar al-Kutub al-Ilmiyah',
    pages: 600,
    assignedToClasses: [6, 7]
  },
  
  // Fiqh (Classes 4-7)
  {
    title: 'Al-Hidaya',
    author: 'Burhan al-Din al-Marghinani',
    category: 'Fiqh',
    description: {
      en: 'Comprehensive Hanafi fiqh text, standard in madrasas worldwide',
      ar: 'نص فقه حنفي شامل، معيار في المدارس الدينية في جميع أنحاء العالم'
    },
    coverUrl: '/images/books/hidaya.jpg',
    pdfUrl: 'https://kitaabun.com/hidaya-vol1.pdf',
    year: 1197,
    language: ['Arabic', 'Urdu'],
    publisher: 'Idara Islamiat',
    pages: 2000,
    assignedToClasses: [6, 7]
  },
  {
    title: 'Mukhtasar al-Quduri',
    author: 'Ahmad ibn Muhammad al-Quduri',
    category: 'Fiqh',
    description: {
      en: 'Concise Hanafi fiqh manual covering essential rulings',
      ar: 'دليل فقه حنفي موجز يغطي الأحكام الأساسية'
    },
    coverUrl: '/images/books/quduri.jpg',
    pdfUrl: 'https://shamela.ws/book/11111',
    year: 1100,
    language: ['Arabic'],
    publisher: 'Dar al-Bashair',
    pages: 400,
    assignedToClasses: [5, 6]
  },
  {
    title: 'Nur al-Idah',
    author: 'Hasan ibn Ammar al-Shurunbulali',
    category: 'Fiqh',
    description: {
      en: 'Light of Clarification - primer on Hanafi fiqh for acts of worship',
      ar: 'نور الإيضاح - مقدمة في الفقه الحنفي لأعمال العبادة'
    },
    coverUrl: '/images/books/nur-idah.jpg',
    pdfUrl: 'https://darussalam.com/nur-idah.pdf',
    year: 1619,
    language: ['Arabic', 'Urdu'],
    publisher: 'Darussalam',
    pages: 250,
    assignedToClasses: [4, 5]
  },
  {
    title: 'Tas-heelul Fiqh (Books 1-4)',
    author: 'Azhar Academy',
    category: 'Fiqh',
    description: {
      en: 'Simplified fiqh series for young students covering wudhu, salah, and basic rulings',
      ar: 'سلسلة فقه مبسطة للطلاب الصغار تغطي الوضوء والصلاة والأحكام الأساسية'
    },
    coverUrl: '/images/books/tasheelul-fiqh.jpg',
    pdfUrl: 'https://azharacademy.com/tasheelul-fiqh.pdf',
    year: 2010,
    language: ['Urdu', 'English'],
    publisher: 'Azhar Academy',
    pages: 150,
    assignedToClasses: [1, 2, 3, 4]
  },
  
  // Aqidah (Classes 1-5)
  {
    title: 'Kitab al-Tawhid',
    author: 'Muhammad ibn Abd al-Wahhab',
    category: 'Aqidah',
    description: {
      en: 'Book of Monotheism - fundamental text on Islamic creed and belief in Allah\'s oneness',
      ar: 'كتاب التوحيد - نص أساسي عن العقيدة الإسلامية والإيمان بوحدانية الله'
    },
    coverUrl: '/images/books/kitab-tawhid.jpg',
    pdfUrl: 'https://darussalam.com/kitab-tawhid.pdf',
    year: 1780,
    language: ['Arabic', 'Urdu', 'English'],
    publisher: 'Darussalam',
    pages: 200,
    assignedToClasses: [5]
  },
  {
    title: 'Aqeedah al-Tahawiyyah',
    author: 'Abu Ja\'far al-Tahawi',
    category: 'Aqidah',
    description: {
      en: 'Classical creed text summarizing Sunni beliefs, widely studied',
      ar: 'نص عقيدة كلاسيكي يلخص المعتقدات السنية، يُدرس على نطاق واسع'
    },
    coverUrl: '/images/books/tahawiyyah.jpg',
    pdfUrl: 'https://shamela.ws/book/22222',
    year: 933,
    language: ['Arabic'],
    publisher: 'Dar al-Kutub al-Ilmiyah',
    pages: 100,
    assignedToClasses: [5, 6]
  },
  {
    title: 'Al-Fiqh al-Akbar',
    author: 'Imam Abu Hanifa',
    category: 'Aqidah',
    description: {
      en: 'The Greater Understanding - foundational Hanafi creed text',
      ar: 'الفقه الأكبر - نص عقيدة حنفي أساسي'
    },
    coverUrl: '/images/books/fiqh-akbar.jpg',
    pdfUrl: 'https://archive.org/download/fiqh-akbar/fiqh-akbar.pdf',
    year: 767,
    language: ['Arabic'],
    publisher: 'Dar al-Nur',
    pages: 50,
    assignedToClasses: [5]
  },
  {
    title: 'Tas-heelul Aqaid (Books 1-3)',
    author: 'Azhar Academy',
    category: 'Aqidah',
    description: {
      en: 'Simplified creed series for children covering basic Islamic beliefs',
      ar: 'سلسلة عقيدة مبسطة للأطفال تغطي المعتقدات الإسلامية الأساسية'
    },
    coverUrl: '/images/books/tasheelul-aqaid.jpg',
    pdfUrl: 'https://azharacademy.com/tasheelul-aqaid.pdf',
    year: 2010,
    language: ['Urdu', 'English'],
    publisher: 'Azhar Academy',
    pages: 100,
    assignedToClasses: [1, 2, 3]
  },
  
  // Sira & History (Classes 3-6)
  {
    title: 'Ar-Raheeq al-Makhtum (The Sealed Nectar)',
    author: 'Safiur-Rahman Mubarakpuri',
    category: 'Sira',
    description: {
      en: 'Biography of Prophet Muhammad (PBUH), award-winning comprehensive seerah',
      ar: 'سيرة النبي محمد صلى الله عليه وسلم، سيرة شاملة حائزة على جوائز'
    },
    coverUrl: '/images/books/raheeq-makhtum.jpg',
    pdfUrl: 'https://darussalam.com/raheeq-makhtum.pdf',
    year: 1976,
    language: ['Arabic', 'Urdu', 'English'],
    publisher: 'Darussalam',
    pages: 600,
    assignedToClasses: [4, 5]
  },
  {
    title: 'Sirat Ibn Hisham',
    author: 'Abd al-Malik ibn Hisham',
    category: 'Sira',
    description: {
      en: 'Classical biography of Prophet Muhammad, one of the earliest sources',
      ar: 'سيرة كلاسيكية للنبي محمد، من أقدم المصادر'
    },
    coverUrl: '/images/books/sirat-ibn-hisham.jpg',
    pdfUrl: 'https://shamela.ws/book/33333',
    year: 833,
    language: ['Arabic'],
    publisher: 'Dar al-Jeel',
    pages: 1000,
    assignedToClasses: [6]
  },
  {
    title: 'Tarikh al-Islam',
    author: 'Shams al-Din al-Dhahabi',
    category: 'Sira',
    description: {
      en: 'History of Islam covering major events and personalities',
      ar: 'تاريخ الإسلام يغطي الأحداث والشخصيات الكبرى'
    },
    coverUrl: '/images/books/tarikh-islam.jpg',
    pdfUrl: 'https://kitaabun.com/tarikh-islam.pdf',
    year: 1348,
    language: ['Arabic', 'Urdu'],
    publisher: 'Dar al-Kutub al-Arabi',
    pages: 15000,
    assignedToClasses: [6, 7]
  },
  {
    title: 'Al-Bidaya wa al-Nihaya',
    author: 'Ibn Kathir',
    category: 'Sira',
    description: {
      en: 'The Beginning and the End - comprehensive Islamic history from creation to the author\'s time',
      ar: 'البداية والنهاية - تاريخ إسلامي شامل من الخلق إلى زمن المؤلف'
    },
    coverUrl: '/images/books/bidaya-nihaya.jpg',
    pdfUrl: 'https://archive.org/download/bidaya-nihaya/bidaya.pdf',
    year: 1373,
    language: ['Arabic'],
    publisher: 'Dar Ihya al-Turath',
    pages: 7000,
    assignedToClasses: [6, 7]
  },
  {
    title: 'Stories of the Prophets (Qisas al-Anbiya)',
    author: 'Ibn Kathir',
    category: 'Sira',
    description: {
      en: 'Stories of all prophets mentioned in the Quran, essential for young students',
      ar: 'قصص جميع الأنبياء المذكورين في القرآن، ضرورية للطلاب الصغار'
    },
    coverUrl: '/images/books/qisas-anbiya.jpg',
    pdfUrl: 'https://goodword.net/qisas-anbiya.pdf',
    year: 1373,
    language: ['Arabic', 'Urdu', 'English'],
    publisher: 'Goodword Books',
    pages: 400,
    assignedToClasses: [3, 4]
  },
  
  // Arabic Grammar (Classes 1-7)
  {
    title: 'Al-Ajurrumiyyah',
    author: 'Ibn Ajurrum',
    category: 'Arabic Grammar',
    description: {
      en: 'Classical Arabic grammar primer, foundational text for Nahw (syntax)',
      ar: 'مقدمة نحو عربي كلاسيكية، نص أساسي للنحو'
    },
    coverUrl: '/images/books/ajurrumiyyah.jpg',
    pdfUrl: 'https://shamela.ws/book/44444',
    year: 1320,
    language: ['Arabic'],
    publisher: 'Dar al-Fikr',
    pages: 80,
    assignedToClasses: [5]
  },
  {
    title: 'Qanoon-e-Sarf',
    author: 'Traditional',
    category: 'Arabic Grammar',
    description: {
      en: 'Rules of Arabic morphology (Sarf) for understanding word forms',
      ar: 'قواعد الصرف العربي لفهم أشكال الكلمات'
    },
    coverUrl: '/images/books/qanoon-sarf.jpg',
    pdfUrl: 'https://kitaabun.com/qanoon-sarf.pdf',
    year: 1900,
    language: ['Arabic', 'Urdu'],
    publisher: 'Maktaba Ashrafia',
    pages: 150,
    assignedToClasses: [4, 5]
  },
  {
    title: 'Nahw al-Wadih',
    author: 'Ali al-Jarim & Mustafa Amin',
    category: 'Arabic Grammar',
    description: {
      en: 'Clear Grammar - modern approach to Arabic syntax with examples',
      ar: 'النحو الواضح - نهج حديث للنحو العربي مع الأمثلة'
    },
    coverUrl: '/images/books/nahw-wadih.jpg',
    pdfUrl: 'https://archive.org/download/nahw-wadih/nahw.pdf',
    year: 1950,
    language: ['Arabic'],
    publisher: 'Dar al-Ma\'arif',
    pages: 300,
    assignedToClasses: [5, 6]
  },
  {
    title: 'My First Arabic Book',
    author: 'Goodword Educational',
    category: 'Arabic Grammar',
    description: {
      en: 'Introduction to Arabic letters and simple words for beginners',
      ar: 'مقدمة للحروف العربية والكلمات البسيطة للمبتدئين'
    },
    coverUrl: '/images/books/first-arabic.jpg',
    pdfUrl: 'https://goodword.net/first-arabic.pdf',
    year: 2015,
    language: ['Arabic', 'English'],
    publisher: 'Goodword Books',
    pages: 50,
    assignedToClasses: [1, 2, 3]
  },
  
  // Tasawwuf/Ethics (Classes 2-7)
  {
    title: 'Ihya Ulum al-Din',
    author: 'Abu Hamid al-Ghazali',
    category: 'Tasawwuf',
    description: {
      en: 'Revival of Religious Sciences - comprehensive work on Islamic spirituality and ethics',
      ar: 'إحياء علوم الدين - عمل شامل عن الروحانية والأخلاق الإسلامية'
    },
    coverUrl: '/images/books/ihya-ulumuddin.jpg',
    pdfUrl: 'https://kitaabun.com/ihya-ulumuddin.pdf',
    year: 1111,
    language: ['Arabic', 'Urdu'],
    publisher: 'Dar al-Minhaj',
    pages: 4000,
    assignedToClasses: [7]
  },
  {
    title: 'Tas-heelul Akhlaq (Books 1-5)',
    author: 'Azhar Academy',
    category: 'Tasawwuf',
    description: {
      en: 'Simplified Islamic ethics series teaching good character for children',
      ar: 'سلسلة أخلاق إسلامية مبسطة لتعليم الأطفال الأخلاق الحسنة'
    },
    coverUrl: '/images/books/tasheelul-akhlaq.jpg',
    pdfUrl: 'https://azharacademy.com/tasheelul-akhlaq.pdf',
    year: 2010,
    language: ['Urdu', 'English'],
    publisher: 'Azhar Academy',
    pages: 120,
    assignedToClasses: [2, 3, 4, 5]
  },
  {
    title: 'An-Nasihah Islamic Curriculum (Books 1-3)',
    author: 'Weekend Learning',
    category: 'General Islamic',
    description: {
      en: 'Comprehensive Islamic studies curriculum covering beliefs, worship, and character',
      ar: 'منهج دراسات إسلامية شامل يغطي المعتقدات والعبادة والأخلاق'
    },
    coverUrl: '/images/books/nasihah.jpg',
    pdfUrl: 'https://weekendlearning.com/nasihah.pdf',
    year: 2008,
    language: ['Urdu', 'English'],
    publisher: 'Weekend Learning',
    pages: 200,
    assignedToClasses: [2, 3]
  },
  
  // Additional Essential Books
  {
    title: 'Durus al-Balagha',
    author: 'Hafni Nasif',
    category: 'Arabic Grammar',
    description: {
      en: 'Lessons in Arabic rhetoric and eloquence',
      ar: 'دروس في البلاغة العربية والفصاحة'
    },
    coverUrl: '/images/books/durus-balagha.jpg',
    pdfUrl: 'https://shamela.ws/book/55555',
    year: 1920,
    language: ['Arabic'],
    publisher: 'Dar al-Kutub al-Misriyah',
    pages: 250,
    assignedToClasses: [6, 7]
  },
  {
    title: 'Mukhtasar al-Ma\'ani (Rhetoric)',
    author: 'Sa\'d al-Din al-Taftazani',
    category: 'Arabic Grammar',
    description: {
      en: 'Concise text on Arabic rhetoric and eloquence principles',
      ar: 'نص موجز عن مبادئ البلاغة والفصاحة العربية'
    },
    coverUrl: '/images/books/mukhtasar-maani.jpg',
    pdfUrl: 'https://kitaabun.com/mukhtasar-maani.pdf',
    year: 1390,
    language: ['Arabic'],
    publisher: 'Dar al-Kutub al-Ilmiyah',
    pages: 180,
    assignedToClasses: [7]
  }
];

const curricula = [
  // Class 1 (Ages 5-6)
  {
    classNumber: 1,
    className: {
      en: 'Class 1 - Foundation',
      ar: 'الصف الأول - الأساس'
    },
    ageRange: { min: 5, max: 6 },
    modules: [
      {
        name: { en: 'Quran Basics', ar: 'أساسيات القرآن' },
        subject: 'Quran Recitation',
        description: {
          en: 'Learning Arabic alphabet, correct pronunciation, and basic recitation',
          ar: 'تعلم الأبجدية العربية والنطق الصحيح والتلاوة الأساسية'
        },
        books: [], // Will be populated with Book IDs
        credits: 3,
        hoursPerWeek: 5
      },
      {
        name: { en: 'Introductory Arabic', ar: 'العربية التمهيدية' },
        subject: 'Arabic Language',
        description: {
          en: 'Learning to read and write Arabic letters, simple words',
          ar: 'تعلم قراءة وكتابة الحروف العربية والكلمات البسيطة'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Simple Fiqh', ar: 'الفقه البسيط' },
        subject: 'Islamic Jurisprudence',
        description: {
          en: 'Basic concepts of wudhu (ablution) and cleanliness',
          ar: 'مفاهيم أساسية عن الوضوء والنظافة'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      },
      {
        name: { en: 'Aqidah Essentials', ar: 'أساسيات العقيدة' },
        subject: 'Islamic Creed',
        description: {
          en: 'Stories and basics of belief in Allah and Prophet Muhammad',
          ar: 'قصص وأساسيات الإيمان بالله والنبي محمد'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Master Arabic alphabet and basic pronunciation',
        'Recite short Surahs correctly',
        'Understand basic Islamic beliefs',
        'Learn simple acts of worship'
      ],
      ar: [
        'إتقان الأبجدية العربية والنطق الأساسي',
        'تلاوة السور القصيرة بشكل صحيح',
        'فهم المعتقدات الإسلامية الأساسية',
        'تعلم أعمال العبادة البسيطة'
      ]
    },
    assessmentMethods: {
      en: ['Oral recitation', 'Writing tests', 'Practical demonstrations'],
      ar: ['التلاوة الشفوية', 'اختبارات الكتابة', 'المظاهرات العملية']
    }
  },

  // Class 2 (Ages 6-7)
  {
    classNumber: 2,
    className: {
      en: 'Class 2 - Early Recitation',
      ar: 'الصف الثاني - التلاوة المبكرة'
    },
    ageRange: { min: 6, max: 7 },
    modules: [
      {
        name: { en: 'Quran Memorization', ar: 'حفظ القرآن' },
        subject: 'Quran Memorization',
        description: {
          en: 'Memorizing short Surahs from Juz Amma',
          ar: 'حفظ السور القصيرة من جزء عم'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 6
      },
      {
        name: { en: 'Basic Grammar', ar: 'النحو الأساسي' },
        subject: 'Arabic Grammar',
        description: {
          en: 'Introduction to Arabic word forms and simple sentences',
          ar: 'مقدمة لأشكال الكلمات العربية والجمل البسيطة'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Daily Ibadat', ar: 'العبادات اليومية' },
        subject: 'Worship',
        description: {
          en: 'Learning adhan, salah basics, and daily supplications',
          ar: 'تعلم الأذان وأساسيات الصلاة والأدعية اليومية'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Akhlaq (Ethics)', ar: 'الأخلاق' },
        subject: 'Islamic Ethics',
        description: {
          en: 'Learning good manners, respect for elders, and Islamic etiquette',
          ar: 'تعلم الآداب الحسنة واحترام الكبار والآداب الإسلامية'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Memorize 10-15 short Surahs',
        'Complete Noorani Qaida',
        'Perform wudhu and salah correctly',
        'Demonstrate good Islamic character'
      ],
      ar: [
        'حفظ 10-15 سورة قصيرة',
        'إكمال القاعدة النورانية',
        'أداء الوضوء والصلاة بشكل صحيح',
        'إظهار الأخلاق الإسلامية الحسنة'
      ]
    },
    assessmentMethods: {
      en: ['Memorization tests', 'Practical salah demonstration', 'Behavior assessment'],
      ar: ['اختبارات الحفظ', 'مظاهرة الصلاة العملية', 'تقييم السلوك']
    }
  },

  // Class 3 (Ages 7-8)
  {
    classNumber: 3,
    className: {
      en: 'Class 3 - Intermediate Basics',
      ar: 'الصف الثالث - الأساسيات المتوسطة'
    },
    ageRange: { min: 7, max: 8 },
    modules: [
      {
        name: { en: 'Juz Amma Recitation', ar: 'تلاوة جزء عم' },
        subject: 'Quran Recitation',
        description: {
          en: 'Complete recitation of the 30th Juz with tajweed basics',
          ar: 'تلاوة كاملة للجزء الثلاثين مع أساسيات التجويد'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 5
      },
      {
        name: { en: 'Nahw Introduction', ar: 'مقدمة في النحو' },
        subject: 'Arabic Syntax',
        description: {
          en: 'Basic sentence structure and parts of speech',
          ar: 'بنية الجملة الأساسية وأقسام الكلام'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Aqidah Stories', ar: 'قصص العقيدة' },
        subject: 'Islamic Creed',
        description: {
          en: 'Stories of prophets and lessons in Islamic belief',
          ar: 'قصص الأنبياء ودروس في العقيدة الإسلامية'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Basic Seerah', ar: 'السيرة الأساسية' },
        subject: 'Prophetic Biography',
        description: {
          en: 'Introduction to the life of Prophet Muhammad (PBUH)',
          ar: 'مقدمة لحياة النبي محمد صلى الله عليه وسلم'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Recite Juz Amma with proper tajweed',
        'Understand basic Arabic sentence structure',
        'Know stories of major prophets',
        'Understand Prophet Muhammad\'s early life'
      ],
      ar: [
        'تلاوة جزء عم بالتجويد الصحيح',
        'فهم بنية الجملة العربية الأساسية',
        'معرفة قصص الأنبياء الرئيسيين',
        'فهم الحياة المبكرة للنبي محمد'
      ]
    },
    assessmentMethods: {
      en: ['Recitation tests with tajweed', 'Grammar exercises', 'Story narration'],
      ar: ['اختبارات التلاوة مع التجويد', 'تمارين النحو', 'سرد القصص']
    }
  },

  // Class 4 (Ages 8-9)
  {
    classNumber: 4,
    className: {
      en: 'Class 4 - Grammar Foundations',
      ar: 'الصف الرابع - أسس النحو'
    },
    ageRange: { min: 8, max: 9 },
    modules: [
      {
        name: { en: 'Sarf Basics', ar: 'أساسيات الصرف' },
        subject: 'Arabic Morphology',
        description: {
          en: 'Study of verb conjugations and noun forms',
          ar: 'دراسة تصريفات الأفعال وأشكال الأسماء'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Fiqh Rulings', ar: 'أحكام الفقه' },
        subject: 'Islamic Jurisprudence',
        description: {
          en: 'Detailed rulings on salah, fasting, and daily worship',
          ar: 'أحكام مفصلة عن الصلاة والصيام والعبادة اليومية'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Prophetic Stories', ar: 'القصص النبوية' },
        subject: 'Seerah',
        description: {
          en: 'Comprehensive study of Prophet Muhammad\'s life',
          ar: 'دراسة شاملة لحياة النبي محمد'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'History Introduction', ar: 'مقدمة في التاريخ' },
        subject: 'Islamic History',
        description: {
          en: 'Early Islamic history and major events',
          ar: 'التاريخ الإسلامي المبكر والأحداث الكبرى'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Master basic Arabic morphology',
        'Apply fiqh rulings in daily life',
        'Know detailed prophetic biography',
        'Understand early Islamic history'
      ],
      ar: [
        'إتقان الصرف العربي الأساسي',
        'تطبيق الأحكام الفقهية في الحياة اليومية',
        'معرفة السيرة النبوية بالتفصيل',
        'فهم التاريخ الإسلامي المبكر'
      ]
    },
    assessmentMethods: {
      en: ['Grammar tests', 'Fiqh practical exams', 'Seerah written tests'],
      ar: ['اختبارات النحو', 'امتحانات فقهية عملية', 'اختبارات السيرة الكتابية']
    }
  },

  // Class 5 (Ages 9-10)
  {
    classNumber: 5,
    className: {
      en: 'Class 5 - Syntax and Creed',
      ar: 'الصف الخامس - النحو والعقيدة'
    },
    ageRange: { min: 9, max: 10 },
    modules: [
      {
        name: { en: 'Nahw al-Wadih', ar: 'النحو الواضح' },
        subject: 'Arabic Syntax',
        description: {
          en: 'Advanced sentence analysis and grammatical parsing',
          ar: 'تحليل الجمل المتقدم والإعراب النحوي'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Aqidah Texts', ar: 'نصوص العقيدة' },
        subject: 'Islamic Creed',
        description: {
          en: 'Study of fundamental Islamic creed texts',
          ar: 'دراسة نصوص العقيدة الإسلامية الأساسية'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Hadith Introduction', ar: 'مقدمة في الحديث' },
        subject: 'Hadith Studies',
        description: {
          en: 'Introduction to hadith collections and daily hadith',
          ar: 'مقدمة لمجموعات الأحاديث والأحاديث اليومية'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Islamic Ethics', ar: 'الأخلاق الإسلامية' },
        subject: 'Akhlaq',
        description: {
          en: 'Character development and Islamic ethics in practice',
          ar: 'تطوير الشخصية والأخلاق الإسلامية في الممارسة'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Parse Arabic sentences grammatically',
        'Understand Islamic creed fundamentals',
        'Memorize and understand 10-15 hadith',
        'Apply Islamic ethics daily'
      ],
      ar: [
        'إعراب الجمل العربية نحوياً',
        'فهم أساسيات العقيدة الإسلامية',
        'حفظ وفهم 10-15 حديثاً',
        'تطبيق الأخلاق الإسلامية يومياً'
      ]
    },
    assessmentMethods: {
      en: ['Grammar parsing tests', 'Creed oral exams', 'Hadith memorization'],
      ar: ['اختبارات الإعراب', 'امتحانات العقيدة الشفوية', 'حفظ الأحاديث']
    }
  },

  // Class 6 (Ages 10-11)
  {
    classNumber: 6,
    className: {
      en: 'Class 6 - Exegesis and Jurisprudence',
      ar: 'الصف السادس - التفسير والفقه'
    },
    ageRange: { min: 10, max: 11 },
    modules: [
      {
        name: { en: 'Tafsir Basics', ar: 'أساسيات التفسير' },
        subject: 'Quranic Exegesis',
        description: {
          en: 'Introduction to Quranic commentary and interpretation',
          ar: 'مقدمة للتفسير القرآني والشرح'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Fiqh Hanafi', ar: 'الفقه الحنفي' },
        subject: 'Hanafi Jurisprudence',
        description: {
          en: 'Detailed study of Hanafi fiqh principles',
          ar: 'دراسة مفصلة لمبادئ الفقه الحنفي'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Islamic History', ar: 'التاريخ الإسلامي' },
        subject: 'History',
        description: {
          en: 'Caliphates and major Islamic historical periods',
          ar: 'الخلافات والفترات التاريخية الإسلامية الكبرى'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Balagha Introduction', ar: 'مقدمة في البلاغة' },
        subject: 'Arabic Rhetoric',
        description: {
          en: 'Introduction to Arabic eloquence and rhetoric',
          ar: 'مقدمة للفصاحة والبلاغة العربية'
        },
        books: [],
        credits: 1,
        hoursPerWeek: 2
      }
    ],
    objectives: {
      en: [
        'Understand Quranic exegesis methods',
        'Apply Hanafi fiqh in worship',
        'Know major Islamic historical events',
        'Appreciate Arabic eloquence'
      ],
      ar: [
        'فهم طرق التفسير القرآني',
        'تطبيق الفقه الحنفي في العبادة',
        'معرفة الأحداث التاريخية الإسلامية الكبرى',
        'تقدير الفصاحة العربية'
      ]
    },
    assessmentMethods: {
      en: ['Tafsir presentations', 'Fiqh case studies', 'History essays'],
      ar: ['عروض التفسير', 'دراسات حالة فقهية', 'مقالات تاريخية']
    }
  },

  // Class 7 (Ages 11-12)
  {
    classNumber: 7,
    className: {
      en: 'Class 7 - Advanced Integration',
      ar: 'الصف السابع - التكامل المتقدم'
    },
    ageRange: { min: 11, max: 12 },
    modules: [
      {
        name: { en: 'Advanced Hadith', ar: 'الحديث المتقدم' },
        subject: 'Hadith Studies',
        description: {
          en: 'Study of Sahih al-Bukhari and Muslim selections',
          ar: 'دراسة مختارات من صحيح البخاري ومسلم'
        },
        books: [],
        credits: 3,
        hoursPerWeek: 4
      },
      {
        name: { en: 'Rhetoric (Balagha)', ar: 'البلاغة' },
        subject: 'Arabic Rhetoric',
        description: {
          en: 'Advanced Arabic eloquence and literary appreciation',
          ar: 'الفصاحة العربية المتقدمة والتقدير الأدبي'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Ethics in Practice', ar: 'الأخلاق في الممارسة' },
        subject: 'Tasawwuf',
        description: {
          en: 'Islamic spirituality and character refinement',
          ar: 'الروحانية الإسلامية وتهذيب الأخلاق'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      },
      {
        name: { en: 'Contemporary Fiqh', ar: 'الفقه المعاصر' },
        subject: 'Jurisprudence',
        description: {
          en: 'Application of Islamic law to modern issues',
          ar: 'تطبيق الشريعة الإسلامية على القضايا الحديثة'
        },
        books: [],
        credits: 2,
        hoursPerWeek: 3
      }
    ],
    objectives: {
      en: [
        'Master major hadith collections',
        'Appreciate Arabic literary excellence',
        'Develop spiritual character',
        'Prepare for advanced Islamic studies'
      ],
      ar: [
        'إتقان مجموعات الأحاديث الرئيسية',
        'تقدير التميز الأدبي العربي',
        'تطوير الشخصية الروحية',
        'الاستعداد للدراسات الإسلامية المتقدمة'
      ]
    },
    assessmentMethods: {
      en: ['Comprehensive exams', 'Research projects', 'Oral presentations'],
      ar: ['امتحانات شاملة', 'مشاريع بحثية', 'عروض شفوية']
    }
  }
];

async function seedCurriculumLibrary() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Book.deleteMany({});
    await Curriculum.deleteMany({});
    console.log('Cleared existing curriculum and library data');

    // Insert books
    const insertedBooks = await Book.insertMany(books);
    console.log(`Inserted ${insertedBooks.length} books`);

    // Create a mapping of book titles to IDs
    const bookMap = {};
    insertedBooks.forEach(book => {
      bookMap[book.title] = book._id;
    });

    // Assign books to curricula modules based on class number
    curricula.forEach(curriculum => {
      curriculum.modules.forEach(module => {
        // Get books assigned to this class number
        const assignedBooks = insertedBooks.filter(book => 
          book.assignedToClasses.includes(curriculum.classNumber) &&
          // Match module subject to book category (simplified mapping)
          (
            (module.subject.includes('Quran') && book.category === 'Arabic Grammar') ||
            (module.subject.includes('Arabic') && book.category === 'Arabic Grammar') ||
            (module.subject.includes('Fiqh') && book.category === 'Fiqh') ||
            (module.subject.includes('Creed') && book.category === 'Aqidah') ||
            (module.subject.includes('Hadith') && book.category === 'Hadith') ||
            (module.subject.includes('Seerah') && book.category === 'Sira') ||
            (module.subject.includes('Tafsir') && book.category === 'Tafsir') ||
            (module.subject.includes('Ethics') && (book.category === 'Tasawwuf' || book.category === 'General Islamic')) ||
            (module.subject.includes('History') && book.category === 'Sira')
          )
        );
        
        module.books = assignedBooks.map(book => book._id);
      });
    });

    // Insert curricula
    const insertedCurricula = await Curriculum.insertMany(curricula);
    console.log(`Inserted ${insertedCurricula.length} curricula`);

    console.log('\nCurriculum and Library seeded successfully!');
    console.log('\nSummary:');
    console.log(`- Total Books: ${insertedBooks.length}`);
    console.log(`- Total Classes: ${insertedCurricula.length}`);
    console.log(`- Classes: 1-7 (Ages 5-12)`);
    console.log('\nBook Categories:');
    const categoryCount = {};
    insertedBooks.forEach(book => {
      categoryCount[book.category] = (categoryCount[book.category] || 0) + 1;
    });
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} books`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error seeding curriculum library:', error);
    process.exit(1);
  }
}

seedCurriculumLibrary();
