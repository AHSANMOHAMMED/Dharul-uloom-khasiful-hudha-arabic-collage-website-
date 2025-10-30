import mongoose from 'mongoose';

const curriculumSchema = new mongoose.Schema({
  classNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  className: {
    en: String,
    ar: String
  },
  ageRange: {
    min: Number,
    max: Number
  },
  modules: [{
    name: {
      en: String,
      ar: String
    },
    subject: String,
    description: {
      en: String,
      ar: String
    },
    books: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    }],
    credits: Number,
    hoursPerWeek: Number
  }],
  objectives: {
    en: [String],
    ar: [String]
  },
  assessmentMethods: {
    en: [String],
    ar: [String]
  }
}, { timestamps: true });

// Ensure only one curriculum per class
curriculumSchema.index({ classNumber: 1 }, { unique: true });

export default mongoose.model('Curriculum', curriculumSchema);
