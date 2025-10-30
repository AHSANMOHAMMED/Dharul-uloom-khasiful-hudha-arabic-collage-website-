import express from 'express';
import Admission from '../models/Admission.js';
import { verifyToken, isStudentOrParent } from '../middleware/auth.js';

const router = express.Router();

// All user routes require authentication
router.use(verifyToken);

// Get user's own admissions
router.get('/admissions', async (req, res) => {
  try {
    const admissions = await Admission.find({ submittedBy: req.user.id })
      .sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      data: admissions 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single admission (only if user owns it)
router.get('/admissions/:id', async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      submittedBy: req.user.id
    });
    
    if (!admission) {
      return res.status(404).json({ 
        success: false, 
        error: 'Admission not found or access denied' 
      });
    }
    
    res.json({ success: true, data: admission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit new admission (for authenticated users)
router.post('/admissions', async (req, res) => {
  try {
    const admissionData = {
      ...req.body,
      submittedBy: req.user.id,
      status: 'pending'
    };

    const admission = await Admission.create(admissionData);
    
    res.status(201).json({ 
      success: true, 
      data: admission,
      message: 'Admission submitted successfully. You will be notified once reviewed.' 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalAdmissions,
      pendingAdmissions,
      approvedAdmissions
    ] = await Promise.all([
      Admission.countDocuments({ submittedBy: req.user.id }),
      Admission.countDocuments({ submittedBy: req.user.id, status: 'pending' }),
      Admission.countDocuments({ submittedBy: req.user.id, status: 'approved' })
    ]);

    res.json({
      success: true,
      data: {
        total: totalAdmissions,
        pending: pendingAdmissions,
        approved: approvedAdmissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
