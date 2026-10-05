import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    if (!process.env.MONGO_URI) {
      console.warn('MONGO_URI not provided — skipping MongoDB connection');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`MongoDB not connected: ${error.message} — fallback active`);
  }
};

export default connectDB;
