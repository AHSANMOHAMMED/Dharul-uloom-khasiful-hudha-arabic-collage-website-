import { supabase, isSupabaseConfigured } from './supabaseClient';

const COVERS_BUCKET = 'covers';
const BOOKS_BUCKET = 'books';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * Thin data-access layer for the library. Every function degrades gracefully
 * when Supabase is not configured yet (returns empty results) so the UI never
 * crashes during the migration period.
 */

const emptyPage = { books: [], total: 0 };

/** Resolve a stored cover path (or absolute URL) into a displayable URL. */
export function resolveCoverUrl(coverImage) {
  if (!coverImage) return null;
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  if (!isSupabaseConfigured) return null;
  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(coverImage);
  return data?.publicUrl ?? null;
}

/** Mint a short-lived signed URL for a private book artifact (PDF/HTML). */
export async function getBookFileUrl(filePath) {
  if (!filePath || !isSupabaseConfigured) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const { data, error } = await supabase.storage
    .from(BOOKS_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL);
  if (error) {
    console.error('[booksApi] signed url error', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Search / browse the catalog through the search_books RPC.
 * @returns {Promise<{books: object[], total: number}>}
 */
export async function searchBooks({
  query = '',
  language = null,
  category = null,
  author = null,
  page = 1,
  pageSize = 24,
} = {}) {
  if (!isSupabaseConfigured) return emptyPage;

  const offset = (Math.max(page, 1) - 1) * pageSize;
  const { data, error } = await supabase.rpc('search_books', {
    q: query ?? '',
    p_language: language,
    p_category: category,
    p_author: author,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    console.error('[booksApi] searchBooks error', error);
    return emptyPage;
  }

  const rows = data ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const books = rows.map((row) => ({
    ...row,
    coverUrl: resolveCoverUrl(row.cover_image),
  }));
  return { books, total };
}

/** Fetch all categories (for filters), ordered for display. */
export async function getCategories() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('id, name_ar, name_en, slug, parent_id, sort_order')
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true });
  if (error) {
    console.error('[booksApi] getCategories error', error);
    return [];
  }
  return data ?? [];
}

/** Fetch a single book with resolved author/category names. */
export async function getBook(id) {
  if (!isSupabaseConfigured || !id) return null;
  // Disambiguate the embeds: books relates to authors/categories both directly
  // (author_id/category_id) and via the book_authors/book_categories junctions,
  // so PostgREST needs the explicit FK hint to avoid an ambiguous-embed error.
  const { data, error } = await supabase
    .from('books')
    .select(
      'id, title_ar, title_en, description, language, year, pages, cover_image, file_path, tags, author_id, category_id, authors!books_author_id_fkey ( name_ar, name_en ), categories!books_category_id_fkey ( name_ar, name_en )'
    )
    .eq('id', id)
    .single();
  if (error) {
    console.error('[booksApi] getBook error', error);
    return null;
  }
  return {
    ...data,
    coverUrl: resolveCoverUrl(data.cover_image),
    author_name: data.authors?.name_ar ?? null,
    category_name: data.categories?.name_ar ?? null,
  };
}

/** Fetch a page-range of a book's cleaned text content for the reader. */
export async function getBookPages(bookId, { from = 0, to = 19 } = {}) {
  if (!isSupabaseConfigured || !bookId) return [];
  const { data, error } = await supabase
    .from('book_pages')
    .select('id, page_index, page_label, part, content')
    .eq('book_id', bookId)
    .order('page_index', { ascending: true })
    .range(from, to);
  if (error) {
    console.error('[booksApi] getBookPages error', error);
    return [];
  }
  return data ?? [];
}

/** Full-text search within a single book (reader search). */
export async function searchWithinBook(bookId, query, limit = 50) {
  if (!isSupabaseConfigured || !bookId || !query) return [];
  const { data, error } = await supabase.rpc('search_book_pages', {
    p_book_id: bookId,
    q: query,
    p_limit: limit,
  });
  if (error) {
    console.error('[booksApi] searchWithinBook error', error);
    return [];
  }
  return data ?? [];
}
