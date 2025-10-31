/**
 * Book Import Script - JSON Format
 * Imports books from JSON file into MongoDB
 * 
 * Usage:
 *   node scripts/importBooksJSON.js books.json
 *   node scripts/importBooksJSON.js books.json --validate (validate only)
 *   node scripts/importBooksJSON.js books.json --dry-run (test without importing)
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Import Book model
const Book = require('../models/Book');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kashiful-hudha', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Validate book data
const validateBook = (book, index) => {
  const errors = [];
  
  if (!book.title || book.title.trim() === '') {
    errors.push(`Book ${index + 1}: Missing title`);
  }
  
  if (!book.author || book.author.trim() === '') {
    errors.push(`Book ${index + 1}: Missing author`);
  }
  
  if (!book.category) {
    errors.push(`Book ${index + 1}: Missing category`);
  } else {
    const validCategories = ['Tafsir', 'Hadith', 'Fiqh', 'Aqidah', 'Sira', 'Tasawwuf', 'Arabic Grammar', 'General Islamic'];
    if (!validCategories.includes(book.category)) {
      errors.push(`Book ${index + 1}: Invalid category "${book.category}". Must be one of: ${validCategories.join(', ')}`);
    }
  }
  
  if (!book.description || !book.description.en) {
    errors.push(`Book ${index + 1}: Missing English description`);
  }
  
  if (!book.year || isNaN(book.year)) {
    errors.push(`Book ${index + 1}: Invalid or missing year`);
  }
  
  if (!book.language || !Array.isArray(book.language) || book.language.length === 0) {
    errors.push(`Book ${index + 1}: Missing or invalid languages (must be array)`);
  }
  
  if (!book.assignedToClasses || !Array.isArray(book.assignedToClasses) || book.assignedToClasses.length === 0) {
    errors.push(`Book ${index + 1}: Missing or invalid assignedToClasses (must be array of 1-7)`);
  } else {
    const invalidClasses = book.assignedToClasses.filter(c => c < 1 || c > 7);
    if (invalidClasses.length > 0) {
      errors.push(`Book ${index + 1}: Invalid class numbers: ${invalidClasses.join(', ')} (must be 1-7)`);
    }
  }
  
  return errors;
};

// Import books
const importBooks = async (filePath, options = {}) => {
  const { validate, dryRun } = options;
  
  try {
    // Read JSON file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const books = JSON.parse(fileContent);
    
    if (!Array.isArray(books)) {
      throw new Error('JSON file must contain an array of books');
    }
    
    console.log(`\n📚 Processing ${books.length} books from ${path.basename(filePath)}...\n`);
    
    // Validate all books
    console.log('🔍 Validating books...');
    const allErrors = [];
    books.forEach((book, index) => {
      const errors = validateBook(book, index);
      if (errors.length > 0) {
        allErrors.push(...errors);
      }
    });
    
    if (allErrors.length > 0) {
      console.error('\n✗ Validation failed:\n');
      allErrors.forEach(error => console.error(`  - ${error}`));
      console.error(`\n✗ Total errors: ${allErrors.length}\n`);
      return;
    }
    
    console.log('✓ All books validated successfully');
    
    if (validate) {
      console.log('\n✓ Validation complete (--validate flag set, not importing)\n');
      return;
    }
    
    if (dryRun) {
      console.log('\n✓ Dry run complete (--dry-run flag set, not importing)\n');
      console.log('Books that would be imported:');
      books.forEach((book, index) => {
        console.log(`  ${index + 1}. ${book.title} - ${book.author} (${book.category})`);
      });
      return;
    }
    
    // Import books
    console.log('\n📥 Importing books to database...\n');
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (let i = 0; i < books.length; i++) {
      const bookData = books[i];
      try {
        // Check if book already exists
        const existing = await Book.findOne({
          title: bookData.title,
          author: bookData.author
        });
        
        if (existing) {
          console.log(`⚠ Skipped (already exists): ${bookData.title}`);
          continue;
        }
        
        // Create new book
        const book = new Book(bookData);
        await book.save();
        
        console.log(`✓ Imported: ${bookData.title} (ID: ${book._id})`);
        successCount++;
      } catch (error) {
        console.error(`✗ Failed: ${bookData.title} - ${error.message}`);
        errors.push({ book: bookData.title, error: error.message });
        failCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary');
    console.log('='.repeat(60));
    console.log(`Total books:     ${books.length}`);
    console.log(`✓ Imported:      ${successCount}`);
    console.log(`✗ Failed:        ${failCount}`);
    console.log(`⚠ Skipped:       ${books.length - successCount - failCount}`);
    console.log('='.repeat(60) + '\n');
    
    // Save errors to log file
    if (errors.length > 0) {
      const errorLog = errors.map(e => `${e.book}: ${e.error}`).join('\n');
      fs.writeFileSync('import_errors.log', errorLog);
      console.log('✗ Error details saved to: import_errors.log\n');
    }
    
  } catch (error) {
    console.error('\n✗ Import failed:', error.message);
    process.exit(1);
  }
};

// Main execution
const main = async () => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Book Import Script - JSON Format

Usage:
  node scripts/importBooksJSON.js <file.json> [options]

Options:
  --validate      Validate books without importing
  --dry-run       Test import without saving to database
  --help, -h      Show this help message

Examples:
  node scripts/importBooksJSON.js books.json
  node scripts/importBooksJSON.js books.json --validate
  node scripts/importBooksJSON.js books.json --dry-run

JSON Format:
  [
    {
      "title": "Book Title",
      "author": "Author Name",
      "category": "Tafsir|Hadith|Fiqh|Aqidah|Sira|Tasawwuf|Arabic Grammar|General Islamic",
      "description": {
        "en": "English description",
        "ar": "Arabic description (optional)"
      },
      "year": 1400,
      "language": ["Arabic", "Urdu", "English"],
      "publisher": "Publisher Name (optional)",
      "isbn": "ISBN (optional)",
      "pages": 500,
      "assignedToClasses": [1, 2, 3],
      "pdfUrl": "/pdfs/book.pdf (optional)",
      "coverUrl": "/covers/book.jpg (optional)"
    }
  ]
    `);
    process.exit(0);
  }
  
  const filePath = args[0];
  const options = {
    validate: args.includes('--validate'),
    dryRun: args.includes('--dry-run')
  };
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`✗ File not found: ${filePath}`);
    process.exit(1);
  }
  
  // Connect to database
  await connectDB();
  
  // Import books
  await importBooks(filePath, options);
  
  // Close database connection
  await mongoose.connection.close();
  console.log('✓ Database connection closed\n');
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importBooks, validateBook };
