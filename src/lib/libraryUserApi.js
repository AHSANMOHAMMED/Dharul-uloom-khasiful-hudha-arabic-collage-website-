import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Per-user engagement helpers (bookmarks, reading progress, notes, favorites).
 * All are no-ops when Supabase is unconfigured or the user is signed out, so
 * callers can use them unconditionally.
 */

async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function getReadingProgress(bookId) {
  const userId = await currentUserId();
  if (!userId || !bookId) return null;
  const { data } = await supabase
    .from('reads')
    .select('last_page, progress')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  return data ?? null;
}

export async function saveReadingProgress(bookId, lastPage, progress) {
  const userId = await currentUserId();
  if (!userId || !bookId) return;
  await supabase.from('reads').upsert(
    {
      user_id: userId,
      book_id: bookId,
      last_page: lastPage,
      progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' }
  );
}

export async function listBookmarks(bookId) {
  const userId = await currentUserId();
  if (!userId || !bookId) return [];
  const { data } = await supabase
    .from('bookmarks')
    .select('id, page_number, label, created_at')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('page_number', { ascending: true });
  return data ?? [];
}

export async function addBookmark(bookId, pageNumber, label) {
  const userId = await currentUserId();
  if (!userId || !bookId) return null;
  const { data } = await supabase
    .from('bookmarks')
    .upsert(
      { user_id: userId, book_id: bookId, page_number: pageNumber, label },
      { onConflict: 'user_id,book_id,page_number' }
    )
    .select()
    .maybeSingle();
  return data ?? null;
}

export async function removeBookmark(bookmarkId) {
  if (!isSupabaseConfigured || !bookmarkId) return;
  await supabase.from('bookmarks').delete().eq('id', bookmarkId);
}

export async function listNotes(bookId) {
  const userId = await currentUserId();
  if (!userId || !bookId) return [];
  const { data } = await supabase
    .from('user_notes')
    .select('id, page_number, content, created_at')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function addNote(bookId, pageNumber, content) {
  const userId = await currentUserId();
  if (!userId || !bookId || !content) return null;
  const { data } = await supabase
    .from('user_notes')
    .insert({ user_id: userId, book_id: bookId, page_number: pageNumber, content })
    .select()
    .maybeSingle();
  return data ?? null;
}

export async function removeNote(noteId) {
  if (!isSupabaseConfigured || !noteId) return;
  await supabase.from('user_notes').delete().eq('id', noteId);
}

export async function isFavorite(bookId) {
  const userId = await currentUserId();
  if (!userId || !bookId) return false;
  const { data } = await supabase
    .from('favorites')
    .select('book_id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  return Boolean(data);
}

export async function toggleFavorite(bookId) {
  const userId = await currentUserId();
  if (!userId || !bookId) return false;
  const already = await isFavorite(bookId);
  if (already) {
    await supabase.from('favorites').delete().eq('user_id', userId).eq('book_id', bookId);
    return false;
  }
  await supabase.from('favorites').insert({ user_id: userId, book_id: bookId });
  return true;
}
