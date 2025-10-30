import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tafsir', 'Hadith', 'Fiqh', 'Aqidah', 'Sira', 'Tasawwuf', 'Arabic Grammar', 'Urdu Translation', 'General Islamic']
  },
  description: {
    en: String,
    ar: String
  },
  coverUrl: String,
  pdfUrl: String,
  year: Number,
  language: [{
    type: String,
    enum: ['Arabic', 'Urdu', 'English', 'Multilingual']
  }],
  isbn: String,
  publisher: String,
  pages: Number,
  assignedToClasses: [{
    type: Number, // 1-7 for class numbers
    min: 1,
    max: 7
  }]
}, { timestamps: true });

// Index for faster searches
bookSchema.index({ title: 'text', author: 'text', category: 1 });

export default mongoose.model('Book', bookSchema);
