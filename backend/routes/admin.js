import express from 'express';
import News from '../models/News.js';
import Faculty from '../models/Faculty.js';
import Admission from '../models/Admission.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Create transporter for sending emails
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured');
    return null;
  }
  
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ====== NEWS MANAGEMENT ======

// Get all news (with pagination)
router.get('/news', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const news = await News.find()
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await News.countDocuments();
    
    res.json({ 
      success: true, 
      data: news,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create news
router.post('/news', async (req, res) => {
  try {
    const news = await News.create(req.body);
    res.status(201).json({ success: true, data: news });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update news
router.put('/news/:id', async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete news
router.delete('/news/:id', async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    res.json({ success: true, message: 'News deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== FACULTY MANAGEMENT ======

// Get all faculty (with pagination)
router.get('/faculty', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const faculty = await Faculty.find()
      .sort({ order: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Faculty.countDocuments();
    
    res.json({ 
      success: true, 
      data: faculty,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create faculty
router.post('/faculty', async (req, res) => {
  try {
    const faculty = await Faculty.create(req.body);
    res.status(201).json({ success: true, data: faculty });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update faculty
router.put('/faculty/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!faculty) {
      return res.status(404).json({ success: false, error: 'Faculty not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete faculty
router.delete('/faculty/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, error: 'Faculty not found' });
    }
    res.json({ success: true, message: 'Faculty deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== ADMISSIONS MANAGEMENT ======

// Get all admissions (with filtering and pagination)
router.get('/admissions', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};
    
    const admissions = await Admission.find(query)
      .populate('submittedBy', 'username email')
      .populate('reviewedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Admission.countDocuments(query);
    
    res.json({ 
      success: true, 
      data: admissions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single admission
router.get('/admissions/:id', async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id)
      .populate('submittedBy', 'username email')
      .populate('reviewedBy', 'username email');
    
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Admission not found' });
    }
    
    res.json({ success: true, data: admission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update admission status (approve/reject)
router.put('/admissions/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be approved, rejected, or pending' 
      });
    }

    const admission = await Admission.findById(req.params.id)
      .populate('submittedBy', 'email username');
    
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Admission not found' });
    }

    admission.status = status;
    admission.notes = notes;
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    await admission.save();

    // Send email notification to applicant
    const transporter = createTransporter();
    if (transporter && admission.email) {
      try {
        const statusText = status === 'approved' ? 'Approved' : 'Reviewed';
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: admission.email,
          subject: `Admission Application ${statusText} - Dharul Uloom Kashiful Hudha`,
          html: `
            <h2>Admission Application Update</h2>
            <p>Dear ${admission.parentName},</p>
            <p>Your admission application for ${admission.studentName} has been ${status}.</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p>For any questions, please contact us at 032-5612355 or 070-5668463.</p>
            <br>
            <p>Best regards,<br>Dharul Uloom Kashiful Hudha Arabic College</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    res.json({ 
      success: true, 
      data: admission,
      message: `Admission ${status} successfully` 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete admission
router.delete('/admissions/:id', async (req, res) => {
  try {
    const admission = await Admission.findByIdAndDelete(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Admission not found' });
    }
    res.json({ success: true, message: 'Admission deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== STATISTICS ======

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalAdmissions,
      pendingAdmissions,
      approvedAdmissions,
      rejectedAdmissions,
      totalNews,
      totalFaculty
    ] = await Promise.all([
      Admission.countDocuments(),
      Admission.countDocuments({ status: 'pending' }),
      Admission.countDocuments({ status: 'approved' }),
      Admission.countDocuments({ status: 'rejected' }),
      News.countDocuments(),
      Faculty.countDocuments()
    ]);

    // Get recent admissions
    const recentAdmissions = await Admission.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('studentName course status createdAt');

    res.json({
      success: true,
      data: {
        admissions: {
          total: totalAdmissions,
          pending: pendingAdmissions,
          approved: approvedAdmissions,
          rejected: rejectedAdmissions
        },
        content: {
          news: totalNews,
          faculty: totalFaculty
        },
        recentAdmissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
