import express from 'express';
import News from '../models/News.js';

const router = express.Router();

// Get all news
router.get('/', async (req, res) => {
  try {
    const { category, limit = 10 } = req.query;
    const query = category ? { category, isPublished: true } : { isPublished: true };
    
    const news = await News.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single news by ID
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create news (admin only - simplified for now)
router.post('/', async (req, res) => {
  try {
    const news = await News.create(req.body);
    res.status(201).json({ success: true, data: news });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
