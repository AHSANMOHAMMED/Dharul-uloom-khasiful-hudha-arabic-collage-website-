import express from 'express';
import News from '../models/News.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all news
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const query = category ? { category, isPublished: true } : { isPublished: true };
    const [news, total] = await Promise.all([News.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit).maxTimeMS(7000).lean(), News.countDocuments(query).maxTimeMS(7000)]);
    res.json({ success: true, data: news, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single news by ID
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findOne({ _id: req.params.id, isPublished: true });
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create news (admin only - simplified for now)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const news = await News.create(req.body);
    res.status(201).json({ success: true, data: news });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
