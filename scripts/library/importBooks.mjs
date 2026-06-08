#!/usr/bin/env node
/**
 * Resumable Google Drive -> Supabase book metadata importer.
 *
 * Input format: JSON or CSV with fields like:
 *   shamela_id,title_ar,title_en,author,categories,description,language,year,pages,drive_file_id,drive_preview_url,cover_url
 *
 * Categories can be a comma-separated string or JSON array string.
 *
 * Usage:
 *   node scripts/library/importBooks.mjs --input ./books.json
 *   node scripts/library/importBooks.mjs --input ./books.csv --batch-size 50
 *   node scripts/library/importBooks.mjs --input ./books.json --reset
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CHECKPOINT_FILE = '.library-import-checkpoint.json';

function parseArgs(argv) {
  const args = { batchSize: 100, reset: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--batch-size') args.batchSize = Number(argv[++i]) || 100;
    else if (value === '--reset') args.reset = true;
  }
  return args;
}

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return { processed: [] };
  return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
}

function writeCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(state, null, 2));
}

function toPreviewUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const match = String(value).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(value).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = match?.[1] || value;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function normalizeCategories(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      // fall through to comma split
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(',').map((v) => v.trim());
  return lines.map((line) => {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));
  });
}

function loadBooks(inputPath) {
  const content = fs.readFileSync(inputPath, 'utf8');
  if (inputPath.toLowerCase().endsWith('.csv')) return parseCsv(content);
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.books || [];
}

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertBatch(supabase, rows) {
  const { data, error } = await supabase
    .from('books')
    .upsert(rows, { onConflict: 'shamela_id' })
    .select('id, shamela_id');
  if (error) throw error;
  return data || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node scripts/library/importBooks.mjs --input ./books.json');
    process.exit(1);
  }

  if (args.reset && fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  const supabase = createSupabaseClient();
  const books = loadBooks(path.resolve(args.input));
  const checkpoint = readCheckpoint();
  const processed = new Set(checkpoint.processed || []);
  const total = books.length;

  console.log(`Loaded ${total} books from ${args.input}`);

  let buffer = [];
  for (const [index, book] of books.entries()) {
    const shamelaId = String(book.shamela_id ?? book.shamelaId ?? book.id ?? '').trim();
    if (!shamelaId || processed.has(shamelaId)) continue;

    const row = {
      shamela_id: shamelaId,
      title_ar: String(book.title_ar ?? book.titleAr ?? '').trim(),
      title_en: book.title_en ?? book.titleEn ?? null,
      author: String(book.author ?? '').trim(),
      categories: normalizeCategories(book.categories),
      description: book.description ?? null,
      language: String(book.language ?? 'ar').trim() || 'ar',
      year: book.year ? Number(book.year) : null,
      pages: book.pages ? Number(book.pages) : null,
      drive_file_id: String(book.drive_file_id ?? book.driveFileId ?? '').trim() || null,
      drive_preview_url: toPreviewUrl(book.drive_preview_url ?? book.drivePreviewUrl ?? book.drive_file_id ?? book.driveFileId),
      cover_url: book.cover_url ?? book.coverUrl ?? null,
      source_link: book.source_link ?? book.sourceLink ?? null,
    };

    if (!row.title_ar || !row.author || !row.drive_preview_url || !row.drive_file_id) {
      console.warn(`Skipping ${shamelaId}: missing title/author/drive file id`);
      continue;
    }

    buffer.push(row);
    processed.add(shamelaId);

    if (buffer.length >= args.batchSize) {
      await upsertBatch(supabase, buffer);
      writeCheckpoint({ processed: Array.from(processed) });
      console.log(`Imported ${processed.size}/${total}`);
      buffer = [];
    }
  }

  if (buffer.length) {
    await upsertBatch(supabase, buffer);
    writeCheckpoint({ processed: Array.from(processed) });
    console.log(`Imported ${processed.size}/${total}`);
  }

  console.log('Import complete.');
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
