import { supabase } from '../config/supabase.js';

/**
 * Backend Supabase utility functions
 * These use the service role key for admin operations (bypasses RLS)
 */

/**
 * Test Supabase connection
 */
export async function testConnection() {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return { success: true, count };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user by ID with profile data
 */
export async function getUserById(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(filters = {}) {
  let query = supabase.from('profiles').select('*');
  
  if (filters.role) {
    query = query.eq('role', filters.role);
  }
  if (filters.accountType) {
    query = query.eq('account_type', filters.accountType);
  }
  if (filters.isApproved !== undefined) {
    query = query.eq('is_approved', filters.isApproved);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(userId) {
  // First delete from profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (profileError) throw profileError;
  
  // Then delete from auth (requires admin client)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) throw authError;
  
  return { success: true };
}

/**
 * Get admissions with filters
 */
export async function getAdmissions(filters = {}) {
  let query = supabase.from('admissions').select('*');
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.submittedBy) {
    query = query.eq('submitted_by', filters.submittedBy);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Update admission status
 */
export async function updateAdmission(admissionId, status, reviewerId) {
  const { data, error } = await supabase
    .from('admissions')
    .update({ 
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', admissionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get news articles
 */
export async function getNews(publishedOnly = true) {
  let query = supabase.from('news').select('*');
  
  if (publishedOnly) {
    query = query.eq('is_published', true);
  }
  
  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Create news article
 */
export async function createNews(article) {
  const { data, error } = await supabase
    .from('news')
    .insert(article)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update news article
 */
export async function updateNews(articleId, updates) {
  const { data, error } = await supabase
    .from('news')
    .update(updates)
    .eq('id', articleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete news article
 */
export async function deleteNews(articleId) {
  const { error } = await supabase
    .from('news')
    .delete()
    .eq('id', articleId);
  if (error) throw error;
  return { success: true };
}

/**
 * Get faculty members
 */
export async function getFaculty() {
  const { data, error } = await supabase
    .from('faculty')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Create faculty member
 */
export async function createFaculty(facultyData) {
  const { data, error } = await supabase
    .from('faculty')
    .insert(facultyData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update faculty member
 */
export async function updateFaculty(facultyId, updates) {
  const { data, error } = await supabase
    .from('faculty')
    .update(updates)
    .eq('id', facultyId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete faculty member
 */
export async function deleteFaculty(facultyId) {
  const { error } = await supabase
    .from('faculty')
    .delete()
    .eq('id', facultyId);
  if (error) throw error;
  return { success: true };
}

/**
 * Get contact messages
 */
export async function getContactMessages() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Mark contact message as read
 */
export async function markContactMessageRead(messageId) {
  const { data, error } = await supabase
    .from('contact_messages')
    .update({ is_read: true })
    .eq('id', messageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get books with pagination
 */
export async function getBooks({ page = 1, pageSize = 24, category = null, language = null } = {}) {
  const offset = (page - 1) * pageSize;
  let query = supabase.from('books').select('*', { count: 'exact' });
  
  if (category) {
    query = query.eq('category_id', category);
  }
  if (language) {
    query = query.eq('language', language);
  }
  
  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return { books: data, total: count || 0, page, pageSize };
}

/**
 * Create book
 */
export async function createBook(bookData) {
  const { data, error } = await supabase
    .from('books')
    .insert(bookData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update book
 */
export async function updateBook(bookId, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', bookId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete book
 */
export async function deleteBook(bookId) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId);
  if (error) throw error;
  return { success: true };
}

export default {
  testConnection,
  getUserById,
  getAllUsers,
  updateUserProfile,
  deleteUser,
  getAdmissions,
  updateAdmission,
  getNews,
  createNews,
  updateNews,
  deleteNews,
  getFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getContactMessages,
  markContactMessageRead,
  getBooks,
  createBook,
  updateBook,
  deleteBook
};
