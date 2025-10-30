import express from 'express';
import Book from '../models/Book.js';

const router = express.Router();

// Get all books with optional filtering
router.get('/books', async (req, res) => {
  try {
    const { category, language, search, classNumber } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};

    if (category) {
      query.category = category;
    }

    if (language) {
      query.language = language;
    }

    if (classNumber) {
      query.assignedToClasses = parseInt(classNumber);
    }

    if (search) {
      query.$text = { $search: search };
    }

    const books = await Book.find(query)
      .sort({ title: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Book.countDocuments(query);

    res.json({
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get single book by ID
router.get('/books/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Get book categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Book.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get books by category with count
router.get('/categories/:category/books', async (req, res) => {
  try {
    const { category } = req.params;
    const books = await Book.find({ category }).sort({ title: 1 });
    res.json({
      category,
      count: books.length,
      books
    });
  } catch (error) {
    console.error('Error fetching category books:', error);
    res.status(500).json({ error: 'Failed to fetch category books' });
  }
});

export default router;
