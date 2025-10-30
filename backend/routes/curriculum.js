import express from 'express';
import Curriculum from '../models/Curriculum.js';

const router = express.Router();

// Get all curricula (all 7 classes)
router.get('/', async (req, res) => {
  try {
    const curricula = await Curriculum.find()
      .populate('modules.books')
      .sort({ classNumber: 1 });
    
    res.json(curricula);
  } catch (error) {
    console.error('Error fetching curricula:', error);
    res.status(500).json({ error: 'Failed to fetch curricula' });
  }
});

// Get curriculum for specific class
router.get('/class/:classNumber', async (req, res) => {
  try {
    const { classNumber } = req.params;
    const curriculum = await Curriculum.findOne({ classNumber: parseInt(classNumber) })
      .populate('modules.books');
    
    if (!curriculum) {
      return res.status(404).json({ error: 'Curriculum not found for this class' });
    }

    res.json(curriculum);
  } catch (error) {
    console.error('Error fetching curriculum:', error);
    res.status(500).json({ error: 'Failed to fetch curriculum' });
  }
});

// Get all modules across all classes
router.get('/modules', async (req, res) => {
  try {
    const curricula = await Curriculum.find().populate('modules.books');
    
    const allModules = [];
    curricula.forEach(curr => {
      curr.modules.forEach(module => {
        allModules.push({
          classNumber: curr.classNumber,
          className: curr.className,
          ...module.toObject()
        });
      });
    });

    res.json(allModules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// Get books for specific class
router.get('/class/:classNumber/books', async (req, res) => {
  try {
    const { classNumber } = req.params;
    const curriculum = await Curriculum.findOne({ classNumber: parseInt(classNumber) })
      .populate('modules.books');
    
    if (!curriculum) {
      return res.status(404).json({ error: 'Curriculum not found' });
    }

    // Extract all books from all modules
    const books = [];
    curriculum.modules.forEach(module => {
      books.push(...module.books);
    });

    // Remove duplicates
    const uniqueBooks = [...new Map(books.map(book => [book._id.toString(), book])).values()];

    res.json({
      classNumber: curriculum.classNumber,
      className: curriculum.className,
      totalBooks: uniqueBooks.length,
      books: uniqueBooks
    });
  } catch (error) {
    console.error('Error fetching class books:', error);
    res.status(500).json({ error: 'Failed to fetch class books' });
  }
});

export default router;
