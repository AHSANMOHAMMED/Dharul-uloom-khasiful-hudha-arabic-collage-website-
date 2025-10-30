import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
    title: {
        en: { type: String, required: true },
        ar: { type: String }
    },
    content: {
        en: { type: String, required: true },
        ar: { type: String }
    },
    date: { type: Date, default: Date.now },
    author: { type: String, default: 'Admin' },
    image: { type: String },
    category: { 
        type: String, 
        enum: ['admissions', 'events', 'announcements', 'general'], 
        default: 'general' 
    },
    isPublished: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model('News', newsSchema);
