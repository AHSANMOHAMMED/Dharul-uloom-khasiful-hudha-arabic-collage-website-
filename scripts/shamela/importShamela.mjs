#!/usr/bin/env node
/**
 * Resumable bulk importer for the Al-Maktaba al-Shamela collection.
 *
 * Pipeline:
 *   1. Download the master database (authors, categories, books metadata).
 *   2. Upsert categories + authors, building shamela_id -> uuid/bigint maps.
 *   3. Upsert book metadata rows (+ book_authors / book_categories joins).
 *   4. For each book: download content, clean Arabic HTML -> text, build an
 *      HTML artifact, upload it to Supabase Storage, insert per-page rows, and
 *      update the book with full_text + page count + file_path.
 *   5. Checkpoint progress so the run resumes after a crash/interruption.
 *
 * Usage:
 *   node scripts/shamela/importShamela.mjs                 # full import (resumes)
 *   node scripts/shamela/importShamela.mjs --limit 50      # first 50 books
 *   node scripts/shamela/importShamela.mjs --books 26592,123
 *   node scripts/shamela/importShamela.mjs --metadata-only # skip page content
 *   node scripts/shamela/importShamela.mjs --concurrency 4
 *   node scripts/shamela/importShamela.mjs --dry-run       # no writes
 *   node scripts/shamela/importShamela.mjs --reset         # clear checkpoint
 *
 * Required env (see docs/SUPABASE_MIGRATION.md):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   SHAMELA_API_KEY, SHAMELA_BOOKS_ENDPOINT, SHAMELA_MASTER_ENDPOINT
 */
import 'dotenv/config';
import fs from 'node:fs';
import { getBook, getCoverUrl, getMaster } from 'shamela';
import pLimit from 'p-limit';
import {
  BOOKS_BUCKET,
  STATE_FILE,
  cleanPage,
  configureShamela,
  getSupabaseAdmin,
  loadState,
  parseAuthorIds,
  parseYear,
  saveState,
  stripHtml,
  withRetry,
} from './lib.mjs';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { concurrency: 3, dryRun: false, metadataOnly: false, reset: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (a === '--books') args.books = argv[++i].split(',').map((s) => parseInt(s, 10));
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--metadata-only') args.metadataOnly = true;
    else if (a === '--reset') args.reset = true;
  }
  return args;
}

const log = (...m) => console.log(...m);

// ---------------------------------------------------------------------------
// Metadata upsert helpers
// ---------------------------------------------------------------------------

async function upsertCategories(supabase, categories, dryRun) {
  const map = new Map(); // shamela_id -> our category id
  if (dryRun) {
    categories.forEach((c) => map.set(Number(c.id), Number(c.id)));
    return map;
  }
  const rows = categories
    .filter((c) => c.is_deleted !== '1')
    .map((c) => ({
      shamela_id: Number(c.id),
      name_ar: c.name?.trim() || `تصنيف ${c.id}`,
      sort_order: parseInt(c.order, 10) || 0,
    }));
  const { data, error } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'shamela_id' })
    .select('id, shamela_id');
  if (error) throw error;
  data.forEach((r) => map.set(Number(r.shamela_id), r.id));
  return map;
}

async function upsertAuthors(supabase, authors, dryRun) {
  const map = new Map(); // shamela_id -> our author id
  if (dryRun) {
    authors.forEach((a) => map.set(Number(a.id), Number(a.id)));
    return map;
  }
  const rows = authors
    .filter((a) => a.is_deleted !== '1')
    .map((a) => ({
      shamela_id: Number(a.id),
      name_ar: a.name?.trim() || `مؤلف ${a.id}`,
      biography: a.biography || null,
      death_year: parseInt(a.death_number, 10) || null,
    }));
  // Upsert in chunks to avoid oversized payloads.
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from('authors')
      .upsert(chunk, { onConflict: 'shamela_id' })
      .select('id, shamela_id');
    if (error) throw error;
    data.forEach((r) => map.set(Number(r.shamela_id), r.id));
  }
  return map;
}

async function upsertBookMetadata(supabase, book, authorMap, categoryMap, dryRun) {
  const authorIds = parseAuthorIds(book.author).map((id) => authorMap.get(id)).filter(Boolean);
  const categoryId = categoryMap.get(Number(book.category)) || null;
  const row = {
    shamela_id: Number(book.id),
    title_ar: book.name?.trim() || `كتاب ${book.id}`,
    description: book.hint ? stripHtml(book.hint) : null,
    language: 'ar',
    year: parseYear(book.date),
    cover_image: getCoverUrl(Number(book.id)),
    author_id: authorIds[0] || null,
    category_id: categoryId,
    is_public: true,
    metadata: { source: 'shamela', type: book.type ?? null },
  };
  if (dryRun) return { id: `dry-${book.id}`, authorIds, categoryId };

  const { data, error } = await supabase
    .from('books')
    .upsert(row, { onConflict: 'shamela_id' })
    .select('id')
    .single();
  if (error) throw error;
  const bookId = data.id;

  if (authorIds.length) {
    await supabase
      .from('book_authors')
      .upsert(authorIds.map((aid) => ({ book_id: bookId, author_id: aid })), {
        onConflict: 'book_id,author_id',
      });
  }
  if (categoryId) {
    await supabase
      .from('book_categories')
      .upsert([{ book_id: bookId, category_id: categoryId }], {
        onConflict: 'book_id,category_id',
      });
  }
  return { id: bookId, authorIds, categoryId };
}

// ---------------------------------------------------------------------------
// Per-book content import
// ---------------------------------------------------------------------------

function buildHtml(title, pages) {
  const body = pages
    .map(
      (p) =>
        `<section class="page" id="p${p.page_index}"><span class="page-label">${
          p.page_label ?? p.page_index
        }</span><div class="content">${escapeHtml(p.content).replace(/\n/g, '<br/>')}</div></section>`
    )
    .join('\n');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>body{font-family:'Amiri','Scheherazade New',serif;line-height:1.9;max-width:820px;margin:auto;padding:1rem;}
.page{border-bottom:1px solid #eee;padding:1rem 0;}.page-label{color:#888;font-size:.8rem;}</style>
</head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function importBookContent(supabase, shamelaBook, bookId, dryRun) {
  const data = await withRetry(() => getBook(Number(shamelaBook.id)), {
    label: `getBook(${shamelaBook.id})`,
  });
  const rawPages = data?.pages ?? [];

  const pages = rawPages.map((p, idx) => {
    const { body } = cleanPage(p.content);
    return {
      page_index: idx + 1,
      page_label: p.page != null ? String(p.page) : (p.number ?? null),
      part: p.part ?? null,
      content: body,
    };
  });
  const fullText = pages.map((p) => p.content).join('\n\n');

  if (dryRun) return pages.length;

  // Upload an HTML artifact to the private books bucket.
  let filePath = null;
  try {
    const html = buildHtml(shamelaBook.name || `كتاب ${shamelaBook.id}`, pages);
    filePath = `shamela/${shamelaBook.id}.html`;
    const { error: upErr } = await supabase.storage
      .from(BOOKS_BUCKET)
      .upload(filePath, new Blob([html], { type: 'text/html' }), { upsert: true });
    if (upErr) throw upErr;
  } catch (err) {
    log(`  ⚠ artifact upload failed for ${shamelaBook.id}: ${err.message}`);
    filePath = null;
  }

  // Replace per-page rows idempotently.
  await supabase.from('book_pages').delete().eq('book_id', bookId);
  for (let i = 0; i < pages.length; i += 500) {
    const chunk = pages.slice(i, i + 500).map((p) => ({ book_id: bookId, ...p }));
    const { error } = await supabase.from('book_pages').insert(chunk);
    if (error) throw error;
  }

  await supabase
    .from('books')
    .update({ full_text: fullText, pages: pages.length, file_path: filePath })
    .eq('id', bookId);

  return pages.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.reset) {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    log('Checkpoint cleared.');
  }

  configureShamela();
  const supabase = getSupabaseAdmin();
  const state = loadState();
  const imported = new Set(state.importedBookIds);
  const failed = new Set(state.failedBookIds);

  log('⇣ Downloading master database...');
  const master = await withRetry(() => getMaster(), { label: 'getMaster' });
  log(`  authors=${master.authors.length} categories=${master.categories.length} books=${master.books.length} (v${master.version})`);

  log('⇡ Upserting categories + authors...');
  const categoryMap = await upsertCategories(supabase, master.categories, args.dryRun);
  const authorMap = await upsertAuthors(supabase, master.authors, args.dryRun);

  // Select which books to process.
  let books = master.books.filter((b) => b.is_deleted !== '1');
  if (args.books) books = books.filter((b) => args.books.includes(Number(b.id)));
  if (args.limit) books = books.slice(0, args.limit);

  log(`⇡ Importing ${books.length} books (concurrency=${args.concurrency}, metadataOnly=${args.metadataOnly}, dryRun=${args.dryRun})`);

  const limit = pLimit(args.concurrency);
  let done = 0;
  let okCount = 0;

  await Promise.all(
    books.map((book) =>
      limit(async () => {
        const sid = Number(book.id);
        if (imported.has(sid) && !args.dryRun) {
          done += 1;
          return;
        }
        try {
          const { id: bookId } = await upsertBookMetadata(
            supabase,
            book,
            authorMap,
            categoryMap,
            args.dryRun
          );
          let pageCount = 0;
          if (!args.metadataOnly) {
            pageCount = await importBookContent(supabase, book, bookId, args.dryRun);
          }
          imported.add(sid);
          failed.delete(sid);
          okCount += 1;
          if (!args.dryRun) {
            saveState({
              version: master.version,
              importedBookIds: [...imported],
              failedBookIds: [...failed],
            });
          }
          log(`  ✓ [${++done}/${books.length}] ${book.name} (${pageCount} pages)`);
        } catch (err) {
          failed.add(sid);
          if (!args.dryRun) {
            saveState({
              version: master.version,
              importedBookIds: [...imported],
              failedBookIds: [...failed],
            });
          }
          log(`  ✗ [${++done}/${books.length}] ${book.name} (id=${sid}): ${err.message}`);
        }
      })
    )
  );

  log(`\nDone. success=${okCount} failed=${failed.size} total=${books.length}`);
  if (failed.size) log(`Failed ids: ${[...failed].join(', ')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
