import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNewsById } from '../lib/contentApi';
import { tx } from '../lib/tx';

const NewsDetail = () => {
  const { id } = useParams();
  useTranslation(); // subscribe: re-render on language change
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await getNewsById(id);
      if (!active) return;
      if (!data) setNotFound(true);
      else setArticle(data);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString(tx('ar-SA', 'en-US'), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        {tx('جاري التحميل...', 'Loading...')}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">{tx('المقال غير موجود', 'Article not found')}</p>
        <Link to="/news" className="text-islamic-green font-medium hover:underline">
          {tx('← العودة للأخبار', '← Back to news')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-islamic-green text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link to="/news" className="text-sm text-gray-200 hover:text-white mb-4 inline-block">
            {tx('← جميع الأخبار', '← All news')}
          </Link>
          <span className="block text-sm text-gray-300 mb-2">{formatDate(article.date)}</span>
          <h1 className="text-3xl md:text-4xl font-bold font-arabic">
            {article.title[tx('ar', 'en')] || article.title.en}
          </h1>
        </div>
      </section>
      <article className="max-w-3xl mx-auto py-12 px-4">
        {article.image && (
          <img src={article.image} alt="" className="w-full rounded-lg shadow-md mb-8 max-h-96 object-cover" />
        )}
        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {article.content[tx('ar', 'en')] || article.content.en}
        </div>
        {article.author && (
          <p className="mt-8 text-sm text-gray-500">
            {tx('بواسطة ', 'By ')}{article.author}
          </p>
        )}
      </article>
    </div>
  );
};

export default NewsDetail;
