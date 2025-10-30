import mongoose from 'mongoose';

const admissionSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    age: { type: Number, required: true, min: 5, max: 15 },
    parentName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    previousEducation: { type: String },
    course: { 
        type: String, 
        required: true,
        enum: ['quran', 'arabic', 'hadith', 'fiqh', 'islamic']
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    submittedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: false
    },
    reviewedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    },
    reviewedAt: { type: Date },
    notes: { type: String }
}, {
    timestamps: true
});

// Create indexes
admissionSchema.index({ status: 1, createdAt: -1 });
admissionSchema.index({ submittedBy: 1 });

export default mongoose.model('Admission', admissionSchema);
