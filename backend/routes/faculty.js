import express from 'express';
import Faculty from '../models/Faculty.js';

const router = express.Router();

// Get all faculty
router.get('/', async (req, res) => {
  try {
    const faculty = await Faculty.find().sort({ order: 1 });
    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single faculty by ID
router.get('/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, error: 'Faculty not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create faculty (admin only - simplified for now)
router.post('/', async (req, res) => {
  try {
    const faculty = await Faculty.create(req.body);
    res.status(201).json({ success: true, data: faculty });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
