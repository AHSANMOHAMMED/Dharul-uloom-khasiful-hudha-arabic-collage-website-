import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema({
    name: {
        en: { type: String, required: true },
        ar: { type: String }
    },
    role: {
        en: { type: String, required: true },
        ar: { type: String }
    },
    bio: {
        en: { type: String },
        ar: { type: String }
    },
    image: { type: String },
    qualifications: [String],
    email: { type: String },
    phone: { type: String },
    order: { type: Number, default: 0 }
}, {
    timestamps: true
});

export default mongoose.model('Faculty', facultySchema);
