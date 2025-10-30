import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['guest', 'student', 'parent', 'admin'], default: 'guest' },
    isVerified: { type: Boolean, default: false },
    preferences: { type: Object },
}, {
    timestamps: true
});

export default mongoose.model('User', userSchema);