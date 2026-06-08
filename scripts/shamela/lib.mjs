// Shared helpers for the Shamela import pipeline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { configure } from 'shamela';
import { sanitizePageContent, splitPageBodyFromFooter } from 'shamela/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STATE_FILE = path.join(__dirname, '.import-state.json');
export const BOOKS_BUCKET = 'books';

// ---------------------------------------------------------------------------
// Configuration / clients
// ---------------------------------------------------------------------------

/** Configure the Shamela SDK from env. Throws if credentials are missing. */
export function configureShamela() {
  const apiKey = process.env.SHAMELA_API_KEY;
  const booksEndpoint = process.env.SHAMELA_BOOKS_ENDPOINT;
  const masterPatchEndpoint = process.env.SHAMELA_MASTER_ENDPOINT;
  if (!apiKey || !booksEndpoint || !masterPatchEndpoint) {
    throw new Error(
      'Missing Shamela credentials. Set SHAMELA_API_KEY, SHAMELA_BOOKS_ENDPOINT and ' +
        'SHAMELA_MASTER_ENDPOINT (request a key from mail@shamela.ws).'
    );
  }
  configure({ apiKey, booksEndpoint, masterPatchEndpoint });
}

/** Create a service-role Supabase client (server-side, bypasses RLS). */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Resumable checkpoint state
// ---------------------------------------------------------------------------

export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { version: null, importedBookIds: [], failedBookIds: [], updatedAt: null };
  }
}

export function saveState(state) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
  );
}

// ---------------------------------------------------------------------------
// Retry / concurrency
// ---------------------------------------------------------------------------

export function isNonRetryableDbError(err) {
  const msg = String(err?.message ?? err);
  return /no space left on device|read-only mode|too many connections/i.test(msg);
}

export async function withRetry(fn, { retries = 4, baseDelay = 1000, label = 'op' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isNonRetryableDbError(err)) throw err;
      if (attempt === retries) break;
      const delay = baseDelay * 2 ** attempt;
      // eslint-disable-next-line no-console
      console.warn(`  ↻ ${label} failed (attempt ${attempt + 1}/${retries + 1}): ${err.message}; retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Content cleaning
// ---------------------------------------------------------------------------

/** Strip remaining HTML tags and collapse whitespace into plain text. */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Turn a raw Shamela page into clean reader text.
 * Uses the SDK's sanitiser, separates footnotes, then strips residual markup.
 */
export function cleanPage(rawContent) {
  if (!rawContent) return { body: '', footnotes: '' };
  let sanitized;
  try {
    sanitized = sanitizePageContent(rawContent);
  } catch {
    sanitized = rawContent;
  }
  let body = sanitized;
  let footnotes = '';
  try {
    const parts = splitPageBodyFromFooter(sanitized);
    if (Array.isArray(parts)) {
      [body, footnotes] = parts;
    }
  } catch {
    /* keep body as-is */
  }
  return { body: stripHtml(body), footnotes: stripHtml(footnotes) };
}

// ---------------------------------------------------------------------------
// Shamela master-row parsing helpers
// ---------------------------------------------------------------------------

/** Parse a serialized author field like "2747, 3147" into numeric ids. */
export function parseAuthorIds(serialized) {
  if (!serialized) return [];
  return String(serialized)
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

/** Parse the Shamela `date` field (99999 means unavailable). */
export function parseYear(date) {
  const n = parseInt(date, 10);
  if (!Number.isFinite(n) || n <= 0 || n >= 99999) return null;
  return n;
}
