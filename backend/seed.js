import mongoose from 'mongoose';
import dotenv from 'dotenv';
import News from './models/News.js';
import Faculty from './models/Faculty.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kashiful-hudha');
    
    console.log('Connected to MongoDB');
    
    // Clear existing data
    await News.deleteMany({});
    await Faculty.deleteMany({});
    
    console.log('Cleared existing data');
    
    // Seed News
    const newsData = [
      {
        title: {
          en: 'New Admissions Open for 2025',
          ar: 'القبول الجديد مفتوح لعام 2025'
        },
        content: {
          en: 'We are pleased to announce that admissions for the academic year 2025 are now open. Parents are encouraged to contact us at 070-5668463 or 071-5576060 for enrollment details.',
          ar: 'يسرنا أن نعلن أن القبول للعام الدراسي 2025 مفتوح الآن. يرجى من أولياء الأمور الاتصال بنا على 070-5668463 أو 071-5576060 للحصول على تفاصيل التسجيل.'
        },
        category: 'admissions',
        date: new Date('2024-10-24')
      },
      {
        title: {
          en: 'Annual Quran Competition 2024',
          ar: 'مسابقة القرآن السنوية 2024'
        },
        content: {
          en: 'Our annual Quran memorization competition was held successfully with participation from all students. Congratulations to all winners!',
          ar: 'أقيمت مسابقة حفظ القرآن السنوية بنجاح بمشاركة جميع الطلاب. تهانينا لجميع الفائزين!'
        },
        category: 'events',
        date: new Date('2024-09-15')
      },
      {
        title: {
          en: 'Eid Al-Fitr Celebration',
          ar: 'احتفال عيد الفطر'
        },
        content: {
          en: 'The college celebrated Eid Al-Fitr with special prayers and community gathering. May Allah accept our fasting and prayers.',
          ar: 'احتفلت الكلية بعيد الفطر بصلاة خاصة وتجمع مجتمعي. تقبل الله صيامنا وصلاتنا.'
        },
        category: 'events',
        date: new Date('2024-04-10')
      }
    ];
    
    await News.insertMany(newsData);
    console.log('News seeded');
    
    // Seed Faculty
    const facultyData = [
      {
        name: {
          en: 'Sheikh Alimuddin',
          ar: 'الشيخ علم الدين'
        },
        role: {
          en: 'Principal',
          ar: 'المدير'
        },
        bio: {
          en: 'Sheikh Alimuddin has over 20 years of experience in Islamic education and Arabic language instruction.',
          ar: 'يتمتع الشيخ علم الدين بخبرة تزيد عن 20 عامًا في التعليم الإسلامي وتدريس اللغة العربية.'
        },
        qualifications: ['Master in Islamic Studies', 'Bachelor in Arabic Literature'],
        order: 1
      },
      {
        name: {
          en: 'Ustadh Mohammed Hassan',
          ar: 'الأستاذ محمد حسن'
        },
        role: {
          en: 'Arabic Teacher',
          ar: 'معلم اللغة العربية'
        },
        bio: {
          en: 'Specialized in Arabic grammar and literature with 15 years of teaching experience.',
          ar: 'متخصص في النحو والأدب العربي مع 15 عامًا من الخبرة التدريسية.'
        },
        qualifications: ['Bachelor in Arabic Language', 'Diploma in Islamic Education'],
        order: 2
      },
      {
        name: {
          en: 'Ustadh Abdul Rahman',
          ar: 'الأستاذ عبد الرحمن'
        },
        role: {
          en: 'Quran Teacher',
          ar: 'معلم القرآن'
        },
        bio: {
          en: 'Expert in Quranic recitation and memorization techniques with Ijazah certification.',
          ar: 'خبير في تلاوة القرآن وتقنيات الحفظ مع شهادة الإجازة.'
        },
        qualifications: ['Ijazah in Quran Recitation', 'Certificate in Tajweed'],
        order: 3
      },
      {
        name: {
          en: 'Ustadh Yusuf Ibrahim',
          ar: 'الأستاذ يوسف إبراهيم'
        },
        role: {
          en: 'Hadith Teacher',
          ar: 'معلم الحديث'
        },
        bio: {
          en: 'Scholar in Hadith sciences with expertise in Sahih al-Bukhari and Muslim.',
          ar: 'عالم في علوم الحديث مع خبرة في صحيح البخاري ومسلم.'
        },
        qualifications: ['Bachelor in Hadith Sciences', 'Islamic Jurisprudence Certification'],
        order: 4
      },
      {
        name: {
          en: 'Ustadh Ismail Farook',
          ar: 'الأستاذ إسماعيل فاروق'
        },
        role: {
          en: 'Fiqh Teacher',
          ar: 'معلم الفقه'
        },
        bio: {
          en: 'Teaching Islamic jurisprudence and practical applications in daily life.',
          ar: 'تدريس الفقه الإسلامي وتطبيقاته العملية في الحياة اليومية.'
        },
        qualifications: ['Master in Islamic Jurisprudence', 'Shariah Law Certification'],
        order: 5
      }
    ];
    
    await Faculty.insertMany(facultyData);
    console.log('Faculty seeded');
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
