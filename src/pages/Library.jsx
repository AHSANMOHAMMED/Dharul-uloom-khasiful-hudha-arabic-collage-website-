import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Library = () => {
  const { t, i18n } = useTranslation();
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  useEffect(() => {
    fetchCategories();
    fetchBooks();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [selectedCategory, pagination.page]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/library/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 12
      };
      
      if (selectedCategory) {
        params.category = selectedCategory;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await axios.get('/api/library/books', { params });
      setBooks(response.data.books);
      setPagination(response.data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching books:', error);
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchBooks();
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-islamic-green to-islamic-dark text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            {i18n.language === 'ar' ? 'المكتبة الإسلامية' : 'Islamic Library'}
          </motion.h1>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-200 mb-6"
          >
            {i18n.language === 'ar'
              ? '120+ كتاب إسلامي أصيل في التفسير والحديث والفقه والمزيد'
              : '120+ Authentic Islamic Books in Tafsir, Hadith, Fiqh, and More'}
          </motion.p>

          {/* Search Bar */}
          <motion.form
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleSearch}
            className="max-w-2xl mx-auto"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={i18n.language === 'ar' ? 'ابحث عن الكتب...' : 'Search for books...'}
                className="flex-1 px-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-islamic-gold"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-islamic-gold text-islamic-green rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
              >
                {i18n.language === 'ar' ? 'بحث' : 'Search'}
              </button>
            </div>
          </motion.form>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-8 px-4 bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            {i18n.language === 'ar' ? 'تصفية حسب الفئة' : 'Filter by Category'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryFilter('')}
              className={`px-4 py-2 rounded-full transition-colors ${
                !selectedCategory
                  ? 'bg-islamic-green text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {i18n.language === 'ar' ? 'الكل' : 'All'}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryFilter(category)}
                className={`px-4 py-2 rounded-full transition-colors ${
                  selectedCategory === category
                    ? 'bg-islamic-green text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Books Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-islamic-green mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading books...'}
              </p>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                {i18n.language === 'ar' ? 'لم يتم العثور على كتب' : 'No books found'}
              </p>
            </div>
          ) : (
            <>
              {/* Book Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {books.map((book, index) => (
                  <motion.div
                    key={book._id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    {/* Book Cover */}
                    <div className="h-48 bg-gradient-to-br from-islamic-green to-islamic-dark flex items-center justify-center">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-white p-4">
                          <div className="text-4xl mb-2">📖</div>
                          <p className="text-sm font-semibold line-clamp-2">{book.title}</p>
                        </div>
                      )}
                    </div>

                    {/* Book Info */}
                    <div className="p-4">
                      <div className="mb-2">
                        <span className="inline-block px-2 py-1 bg-islamic-green text-white text-xs rounded-full">
                          {book.category}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg mb-1 text-gray-800 line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                      
                      {/* Languages */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {book.language.map((lang, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {lang}
                          </span>
                        ))}
                      </div>

                      {/* Description */}
                      {book.description && (
                        <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                          {book.description[i18n.language]}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {book.pdfUrl && (
                          <a
                            href={book.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center px-3 py-2 bg-islamic-green text-white text-sm rounded hover:bg-islamic-dark transition-colors"
                          >
                            {i18n.language === 'ar' ? 'PDF' : 'PDF'}
                          </a>
                        )}
                        {book.assignedToClasses && book.assignedToClasses.length > 0 && (
                          <div className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded">
                            {i18n.language === 'ar' ? 'الصف' : 'Class'}: {book.assignedToClasses.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      {book.year && (
                        <p className="text-xs text-gray-500 mt-2">
                          {i18n.language === 'ar' ? 'السنة' : 'Year'}: {book.year}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-12 flex justify-center gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {i18n.language === 'ar' ? 'السابق' : 'Previous'}
                  </button>
                  <span className="px-4 py-2 bg-islamic-green text-white rounded-lg">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {i18n.language === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Info Box */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 bg-gradient-to-br from-islamic-green to-islamic-dark text-white p-8 rounded-lg"
          >
            <h3 className="text-2xl font-bold mb-4">
              {i18n.language === 'ar' ? 'عن مكتبتنا' : 'About Our Library'}
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2 text-islamic-gold">
                  {i18n.language === 'ar' ? 'المصادر الموثوقة' : 'Authentic Sources'}
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Shamela.ws (8,000+ books)</li>
                  <li>Internet Archive</li>
                  <li>Bibliotheca Alexandrina</li>
                  <li>Darussalam Publishers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-islamic-gold">
                  {i18n.language === 'ar' ? 'الفئات' : 'Categories'}
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>{i18n.language === 'ar' ? 'التفسير' : 'Tafsir'}</li>
                  <li>{i18n.language === 'ar' ? 'الحديث' : 'Hadith'}</li>
                  <li>{i18n.language === 'ar' ? 'الفقه' : 'Fiqh'}</li>
                  <li>{i18n.language === 'ar' ? 'العقيدة' : 'Aqidah'}</li>
                  <li>{i18n.language === 'ar' ? 'السيرة' : 'Sira'}</li>
                  <li>{i18n.language === 'ar' ? 'النحو العربي' : 'Arabic Grammar'}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-islamic-gold">
                  {i18n.language === 'ar' ? 'دعم متعدد اللغات' : 'Multilingual Support'}
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>{i18n.language === 'ar' ? 'العربية' : 'Arabic'}</li>
                  <li>{i18n.language === 'ar' ? 'الأردية' : 'Urdu'}</li>
                  <li>{i18n.language === 'ar' ? 'الإنجليزية' : 'English'}</li>
                  <li>{i18n.language === 'ar' ? 'ترجمات متعددة اللغات' : 'Multilingual Translations'}</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/curriculum"
                className="inline-block px-6 py-3 bg-islamic-gold text-islamic-green rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
              >
                {i18n.language === 'ar' ? 'عرض المنهج الدراسي' : 'View Curriculum'}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Library;
