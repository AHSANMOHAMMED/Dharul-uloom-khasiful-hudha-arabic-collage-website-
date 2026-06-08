import { supabase, isSupabaseConfigured } from './supabaseClient';

const DEFAULT_PAGE_SIZE = 24;

const emptyPage = { books: [], total: 0 };

export function getDriveFileIdFromUrl(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
  const match = String(input).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(input).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function buildDrivePreviewUrl(fileIdOrUrl) {
  const fileId = getDriveFileIdFromUrl(fileIdOrUrl);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function buildDriveDownloadUrl(fileIdOrUrl) {
  const fileId = getDriveFileIdFromUrl(fileIdOrUrl);
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function resolveCoverUrl(coverUrl) {
  if (!coverUrl) return null;
  if (/^https?:\/\//i.test(coverUrl)) return coverUrl;
  if (!isSupabaseConfigured) return null;
  const { data } = supabase.storage.from('covers').getPublicUrl(coverUrl);
  return data?.publicUrl ?? null;
}

export async function getBookFileUrl(book) {
  if (!book) return null;
  if (book.drive_preview_url) return book.drive_preview_url;
  if (book.drive_file_id) return buildDrivePreviewUrl(book.drive_file_id);
  return null;
}

function normalizeBook(row) {
  const categories = Array.isArray(row.categories) ? row.categories : [];
  return {
    id: row.id,
    shamela_id: row.shamela_id,
    title_ar: row.title_ar,
    title_en: row.title_en,
    author: row.author,
    categories,
    description: row.description,
    language: row.language || 'ar',
    year: row.year,
    pages: row.pages,
    drive_file_id: row.drive_file_id,
    drive_preview_url: row.drive_preview_url,
    cover_url: resolveCoverUrl(row.cover_url),
    source_link: row.source_link,
    imported_at: row.imported_at,
  };
}

function buildCategoryOptions(books = []) {
  const values = new Set();
  books.forEach((book) => {
    (book.categories || []).forEach((category) => values.add(category));
  });
  return Array.from(values)
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((value) => ({ value, label: value }));
}

export async function searchBooks({
  query = '',
  language = null,
  category = null,
  author = null,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
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
  return {
    books: rows.map(normalizeBook),
    total,
  };
}

export async function getBooks(options = {}) {
  return searchBooks(options);
}

export async function getBook(id) {
  if (!isSupabaseConfigured || !id) return null;
  const { data, error } = await supabase
    .from('books')
    .select('id, shamela_id, title_ar, title_en, author, categories, description, language, year, pages, drive_file_id, drive_preview_url, cover_url, source_link, imported_at')
    .eq('id', id)
    .single();
  if (error) {
    console.error('[booksApi] getBook error', error);
    return null;
  }
  return normalizeBook(data);
}

export async function getCategories() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('books')
    .select('categories')
    .order('imported_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[booksApi] getCategories error', error);
    return [];
  }
  return buildCategoryOptions(data ?? []);
}

export async function getBookFilePreviewUrl(book) {
  if (!book) return null;
  if (book.drive_preview_url) return book.drive_preview_url;
  return buildDrivePreviewUrl(book.drive_file_id);
}

export async function createDrivePdfUrl(book) {
  if (!book) return null;
  return buildDriveDownloadUrl(book.drive_file_id || book.drive_preview_url);
}

// Compatibility helpers for older parts of the app.
export async function getBookPages() {
  return [];
}

export async function searchWithinBook() {
  return [];
}
