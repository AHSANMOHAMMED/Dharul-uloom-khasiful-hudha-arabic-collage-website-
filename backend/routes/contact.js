import express from 'express';
import Contact from '../models/Contact.js';
import nodemailer from 'nodemailer';
import { validateContact } from '../middleware/validation.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create transporter for sending emails
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured');
    return null;
  }
  
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    connectionTimeout: 2000,
    greetingTimeout: 2000,
    socketTimeout: 3000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Submit contact form
router.post('/', validateContact, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    // Save to database
    const contact = await Contact.create({
      name,
      email,
      phone,
      subject: subject || 'General Inquiry',
      message
    });
    
    // Send email notification
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `Contact Form: ${subject || 'General Inquiry'}`,
          html: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Thank you for your message. We will get back to you soon.',
      data: contact 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all contacts (admin only - simplified for now)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const [contacts, total] = await Promise.all([
      Contact.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Contact.countDocuments(),
    ]);
    res.json({ success: true, data: contacts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
