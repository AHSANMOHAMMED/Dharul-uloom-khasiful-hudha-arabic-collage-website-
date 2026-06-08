#!/usr/bin/env node
/**
 * Import Shamela books from the Internet Archive full zip (no API key).
 *
 * Supports:
 *   - Shamela v4 zip (shamela_ps): SQLite catalog under shamela_4/database/
 *   - Shamela v3 zip: .bok files (requires mdbtools)
 *
 * Prerequisites:
 *   python3 (stdlib zipfile + sqlite3) — always
 *   brew install mdbtools — only for v3 .bok archives
 *
 * Usage:
 *   npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --limit 5
 *   npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --metadata-only
 *   npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --with-elasticsearch --import-pages --limit 5
 *
 * Env:
 *   SHAMELA_ARCHIVE_URL   optional download URL
 *   SHAMELA_ARCHIVE_PATH  optional local zip path
 */
import 'dotenv/config';
import pLimit from 'p-limit';
import {
  BOOKS_BUCKET,
  getSupabaseAdmin,
  sleep,
  stripHtml,
  isNonRetryableDbError,
  withRetry,
} from './lib.mjs';
import {
  ARCHIVE_STATE_FILE,
  DEFAULT_ARCHIVE_URL,
  categorySlug,
  loadArchiveState,
  parseBokFile,
  resolveArchiveRoot,
  saveArchiveState,
} from './archiveLib.mjs';
import {
  readBookPagesFromDb,
  readBookPagesFromZip,
  resolveBookDbPath,
} from './v4Archive.mjs';
import { fetchBookPagesFromEs, stopElasticsearch } from './shamelaEs.mjs';

function parseArgs(argv) {
  const args = {
    concurrency: 6,
    dryRun: false,
    metadataOnly: false,
    withElasticsearch: false,
    importPages: false,
    reset: false,
    archiveUrl: process.env.SHAMELA_ARCHIVE_URL || DEFAULT_ARCHIVE_URL,
    archivePath: process.env.SHAMELA_ARCHIVE_PATH || null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (a === '--archive-url') args.archiveUrl = argv[++i];
    else if (a === '--archive-path') args.archivePath = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--metadata-only') args.metadataOnly = true;
    else if (a === '--with-elasticsearch') args.withElasticsearch = true;
    else if (a === '--import-pages') args.importPages = true;
    else if (a === '--reset') args.reset = true;
    else if (a === '--retry-failed') args.retryFailed = true;
  }
  return args;
}

const log = (...m) => console.log(...m);

const authorCache = new Map();
const categoryCache = new Map();

async function upsertAuthor(supabase, { shamelaId, name }, dryRun) {
  if (!name) return null;
  const cacheKey = shamelaId || name;
  if (authorCache.has(cacheKey)) return authorCache.get(cacheKey);

  if (dryRun) {
    authorCache.set(cacheKey, shamelaId || 1);
    return shamelaId || 1;
  }

  if (shamelaId) {
    const { data, error } = await supabase
      .from('authors')
      .upsert({ shamela_id: shamelaId, name_ar: name }, { onConflict: 'shamela_id' })
      .select('id')
      .single();
    if (error) throw error;
    authorCache.set(cacheKey, data.id);
    return data.id;
  }

  const { data: existing } = await supabase.from('authors').select('id').eq('name_ar', name).maybeSingle();
  if (existing?.id) {
    authorCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data, error } = await supabase.from('authors').insert({ name_ar: name }).select('id').single();
  if (error) throw error;
  authorCache.set(cacheKey, data.id);
  return data.id;
}

async function upsertCategory(supabase, name, dryRun, shamelaId = null) {
  const label = name?.trim() || 'غير مصنف';
  const slug = shamelaId != null ? `shamela-cat-${shamelaId}` : categorySlug(label);
  if (categoryCache.has(slug)) return categoryCache.get(slug);

  if (dryRun) {
    categoryCache.set(slug, 1);
    return 1;
  }

  const row = {
    slug,
    name_ar: label,
    name_en: label,
    sort_order: shamelaId ?? 0,
    ...(shamelaId != null ? { shamela_id: shamelaId } : {}),
  };
  const { data, error } = await supabase
    .from('categories')
    .upsert(row, { onConflict: shamelaId != null ? 'shamela_id' : 'slug' })
    .select('id')
    .single();
  if (error) throw error;
  categoryCache.set(slug, data.id);
  return data.id;
}

function buildHtml(title, pages) {
  const body = pages
    .map(
      (p) =>
        `<section class="page" id="p${p.page_index}"><span class="page-label">${p.page_label ?? p.page_index}</span><div class="content">${escapeHtml(p.content).replace(/\n/g, '<br/>')}</div></section>`
    )
    .join('\n');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function upsertBook(supabase, parsed, dryRun) {
  const authorId = await upsertAuthor(
    supabase,
    { shamelaId: parsed.authorId, name: parsed.authorName },
    dryRun
  );
  const categoryId = await upsertCategory(
    supabase,
    parsed.categoryName,
    dryRun,
    parsed.categoryId ?? null
  );

  const row = {
    shamela_id: parsed.bkId,
    title_ar: parsed.title,
    description: parsed.description ? stripHtml(parsed.description) : null,
    language: 'ar',
    year: parsed.year,
    author_id: authorId,
    category_id: categoryId,
    is_public: true,
    metadata: { source: 'shamela-archive', file: parsed.sourcePath },
  };

  if (dryRun) return { id: `dry-${parsed.bkId}`, pages: parsed.pages };

  const { data, error } = await supabase
    .from('books')
    .upsert(row, { onConflict: 'shamela_id' })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, pages: parsed.pages };
}

const MAX_PAGE_CHARS = 24_000;
const FULL_TEXT_MAX_PAGES = 120;
const STORAGE_HTML_MAX_PAGES = 250;

function isTransientDbError(err) {
  const msg = String(err?.message ?? err);
  return /timeout|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
}

function pageChunkSize(pageCount) {
  if (pageCount > 2000) return 3;
  if (pageCount > 500) return 5;
  if (pageCount > 150) return 10;
  return 20;
}

function preparePages(bookId, pages) {
  return pages.map((p) => ({
    book_id: bookId,
    page_index: p.page_index,
    page_label: p.page_label,
    part: p.part,
    content:
      p.content.length > MAX_PAGE_CHARS
        ? `${p.content.slice(0, MAX_PAGE_CHARS)}\n\n[… مقطوع للاستيراد …]`
        : p.content,
  }));
}

async function upsertPageRows(supabase, rows, shamelaId, label) {
  const { error } = await supabase.from('book_pages').upsert(rows, {
    onConflict: 'book_id,page_index',
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

async function upsertChunkResilient(supabase, bookId, chunk, shamelaId, offset) {
  const rows = chunk.map((p) => ({ book_id: bookId, ...p }));
  try {
    await withRetry(() => upsertPageRows(supabase, rows, shamelaId, offset), {
      label: `upsert pages ${shamelaId} @${offset}`,
      retries: 4,
      baseDelay: 4000,
    });
  } catch (err) {
    if (!isTransientDbError(err) || rows.length === 1) throw err;
    for (const row of rows) {
      await withRetry(() => upsertPageRows(supabase, [row], shamelaId, row.page_index), {
        label: `upsert page ${shamelaId} #${row.page_index}`,
        retries: 6,
        baseDelay: 5000,
      });
      await sleep(150);
    }
  }
}

async function countBookPages(supabase, bookId) {
  const { count, error } = await supabase
    .from('book_pages')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId);
  if (error) throw error;
  return count ?? 0;
}

async function importPages(supabase, bookId, shamelaId, title, pages, dryRun) {
  if (dryRun) return pages.length;

  const prepared = preparePages(bookId, pages);
  const chunkSize = pageChunkSize(prepared.length);
  if (prepared.length > 200) {
    log(`  … ${title.slice(0, 36)}… (${prepared.length} pg, chunk=${chunkSize})`);
  }

  let filePath = null;
  if (prepared.length <= STORAGE_HTML_MAX_PAGES) {
    try {
      const html = buildHtml(title, prepared);
      filePath = `shamela/${shamelaId}.html`;
      await withRetry(
        async () => {
          const { error: upErr } = await supabase.storage
            .from(BOOKS_BUCKET)
            .upload(filePath, new Blob([html], { type: 'text/html' }), { upsert: true });
          if (upErr) throw upErr;
        },
        { label: `storage ${shamelaId}`,
        retries: 2,
        baseDelay: 5000 }
      );
    } catch (err) {
      log(`  ⚠ storage upload skipped for ${shamelaId}: ${err.message}`);
    }
  }

  for (let i = 0; i < prepared.length; i += chunkSize) {
    await upsertChunkResilient(supabase, bookId, prepared.slice(i, i + chunkSize), shamelaId, i);
    if (prepared.length > 300 && i > 0 && i % 300 === 0) await sleep(800);
  }

  const stored = await countBookPages(supabase, bookId);
  const minOk = Math.max(1, Math.floor(prepared.length * 0.92));
  if (stored < minOk) {
    throw new Error(`only ${stored}/${prepared.length} pages saved`);
  }

  try {
    const updateRow = { pages: stored, file_path: filePath, full_text: null };
    if (stored <= FULL_TEXT_MAX_PAGES) {
      const { data: sample } = await supabase
        .from('book_pages')
        .select('content')
        .eq('book_id', bookId)
        .order('page_index')
        .limit(stored);
      if (sample?.length) {
        updateRow.full_text = sample.map((r) => r.content).join('\n\n').slice(0, 500_000);
      }
    }
    await withRetry(
      async () => {
        const { error } = await supabase.from('books').update(updateRow).eq('id', bookId);
        if (error) throw error;
      },
      { label: `update book ${shamelaId}`,
      retries: 4,
      baseDelay: 4000 }
    );
  } catch (err) {
    await supabase.from('books').update({ pages: stored }).eq('id', bookId);
    log(`  ⚠ metadata update partial for ${shamelaId}: ${err.message}`);
  }

  return stored;
}

function v4BookToParsed(meta, pages, sourcePath) {
  return {
    bkId: meta.book_id,
    title: meta.title || `كتاب ${meta.book_id}`,
    authorName: meta.author_name || null,
    authorId: meta.main_author_id || null,
    categoryName: meta.category_name || null,
    categoryId: meta.category_id || null,
    year: meta.year || null,
    description: null,
    pages,
    sourcePath,
  };
}

async function loadV4Pages(meta, archive, args) {
  if (args.metadataOnly) return [];

  const bookDbPath = resolveBookDbPath(archive.root, meta.book_id);
  let pages = [];
  if (archive.root && bookDbPath) {
    try {
      pages = await readBookPagesFromDb(bookDbPath);
    } catch {
      pages = [];
    }
  }
  if (!pages.length) {
    try {
      pages = await readBookPagesFromZip(archive.zipPath, meta.book_id);
    } catch {
      pages = [];
    }
  }
  if (!pages.length && args.withElasticsearch) {
    pages = await withRetry(
      () => fetchBookPagesFromEs(meta.book_id, archive.root, archive.zipPath),
      { label: `ES pages ${meta.book_id}`, retries: 4, baseDelay: 3000 }
    );
  }
  return pages;
}

async function importV3(archive, args, supabase, state) {
  const imported = new Set(state.importedBookIds || []);
  const failed = new Set(state.failedBookIds || []);
  let files = archive.bokFiles;
  if (args.limit) files = files.slice(0, args.limit);

  log(`Found ${archive.bokFiles.length} .bok files (v3)`);
  log(`Importing ${files.length} books (concurrency=${args.concurrency}, metadataOnly=${args.metadataOnly})`);

  const limit = pLimit(args.concurrency);
  let done = 0;
  let okCount = 0;

  await Promise.all(
    files.map((bokPath) =>
      limit(async () => {
        let bkId;
        try {
          const parsed = await withRetry(() => parseBokFile(bokPath), { label: pathBasename(bokPath) });
          bkId = parsed.bkId;
          if (imported.has(bkId) && !args.dryRun) {
            done += 1;
            return;
          }

          const { id: bookId, pages } = await upsertBook(supabase, parsed, args.dryRun);
          let pageCount = 0;
          if (!args.metadataOnly && pages.length) {
            pageCount = await importPages(supabase, bookId, parsed.bkId, parsed.title, pages, args.dryRun);
          }

          imported.add(bkId);
          failed.delete(bkId);
          okCount += 1;
          if (!args.dryRun) {
            saveArchiveState({ importedBookIds: [...imported], failedBookIds: [...failed] });
          }
          log(`  ✓ [${++done}/${files.length}] ${parsed.title} (id=${bkId}, ${pageCount} pages)`);
        } catch (err) {
          if (bkId) failed.add(bkId);
          if (!args.dryRun && bkId) {
            saveArchiveState({ importedBookIds: [...imported], failedBookIds: [...failed] });
          }
          log(`  ✗ [${++done}/${files.length}] ${pathBasename(bokPath)}: ${err.message}`);
        }
      })
    )
  );

  return { okCount, skipped: 0, failed, total: files.length };
}

async function bookNeedsPages(supabase, shamelaId) {
  const { data: book } = await supabase
    .from('books')
    .select('id, pages')
    .eq('shamela_id', shamelaId)
    .maybeSingle();
  if (!book?.id) return true;

  const { count } = await supabase
    .from('book_pages')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', book.id);
  const rowCount = count ?? 0;
  const declared = book.pages ?? 0;

  if (rowCount === 0) return true;
  if (declared > 0 && rowCount >= declared) return false;
  // Partial import (rows exist but books.pages not updated) — resume via upsert.
  return true;
}

async function importV4(archive, args, supabase, state) {
  if (args.withElasticsearch) args.importPages = true;

  const imported = new Set(state.importedBookIds || []);
  const failed = new Set(state.failedBookIds || []);
  let books = archive.books;
  if (args.retryFailed) {
    const failedIds = failed.size ? failed : new Set(state.failedBookIds || []);
    books = books.filter((b) => failedIds.has(b.book_id));
    log(`Retry-failed mode: ${books.length} books to retry.`);
  }
  if (args.limit) books = books.slice(0, args.limit);

  log(`Shamela v4 archive: ${archive.books.length} books in master.db`);
  log(`Archive zip: ${archive.zipPath}`);
  if (!args.metadataOnly && !args.withElasticsearch) {
    log(
      'Note: v4 book SQLite files do not contain page text (text is in the bundled Elasticsearch index).\n' +
        '      Importing catalog only. Add --with-elasticsearch to extract ~7 GB and import readable pages,\n' +
        '      or use: npm run import:shamela (requires SHAMELA_API_KEY) for page content.'
    );
    args.metadataOnly = true;
  }

  if (args.importPages && args.withElasticsearch) {
    log('Starting local Elasticsearch (requires Java 11 — brew install openjdk@11)…');
    const { ensureV4ElasticsearchExtracted } = await import('./v4Archive.mjs');
    const { startElasticsearch } = await import('./shamelaEs.mjs');
    await ensureV4ElasticsearchExtracted(archive.zipPath, archive.root);
    await startElasticsearch(archive.root);
    if (args.concurrency > 1) {
      log(`Lowering concurrency ${args.concurrency} → 1 for page import (Supabase + ES stability).`);
      args.concurrency = 1;
    }
    log('Tip: run only one import at a time. If ES lock errors persist: pkill -f shamela_4/elastic');
  }

  const limit = pLimit(args.concurrency);
  let done = 0;
  let okCount = 0;
  let skipped = 0;

  await Promise.all(
    books.map((meta) =>
      limit(async () => {
        const bkId = meta.book_id;
        try {
          const needsPages = args.importPages ? await bookNeedsPages(supabase, bkId) : false;
          const skipCatalog = imported.has(bkId) && !args.dryRun && !needsPages;
          if (skipCatalog) {
            skipped += 1;
            done += 1;
            return;
          }

          const pages = await loadV4Pages(meta, archive, args);
          const parsed = v4BookToParsed(meta, pages, meta.zip_path);
          const { id: bookId, pages: parsedPages } = await upsertBook(supabase, parsed, args.dryRun);

          let pageCount = 0;
          if (!args.metadataOnly && parsedPages.length) {
            pageCount = await importPages(supabase, bookId, bkId, parsed.title, parsedPages, args.dryRun);
          }

          imported.add(bkId);
          failed.delete(bkId);
          okCount += 1;
          if (!args.dryRun) {
            saveArchiveState({ importedBookIds: [...imported], failedBookIds: [...failed] });
          }
          log(`  ✓ [${++done}/${books.length}] ${parsed.title} (id=${bkId}, ${pageCount} pages)`);
        } catch (err) {
          failed.add(bkId);
          if (!args.dryRun) {
            saveArchiveState({ importedBookIds: [...imported], failedBookIds: [...failed] });
          }
          log(`  ✗ [${++done}/${books.length}] book ${bkId}: ${err.message}`);
          if (isNonRetryableDbError(err)) {
            throw new Error(
              `${err.message}\n\nSupabase database is full or read-only. Free disk space in the Supabase dashboard ` +
                '(Project Settings → Database → increase disk), wait a few minutes, then run with --retry-failed.'
            );
          }
        }
      })
    )
  );

  stopElasticsearch();
  if (skipped) log(`Skipped ${skipped} books (already in catalog with pages or checkpoint).`);
  return { okCount, skipped, failed, total: books.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.reset) {
    const fs = await import('node:fs');
    if (fs.existsSync(ARCHIVE_STATE_FILE)) fs.unlinkSync(ARCHIVE_STATE_FILE);
    log('Archive import checkpoint cleared.');
  }

  const supabase = getSupabaseAdmin();
  const state = loadArchiveState();
  const archive = await resolveArchiveRoot({
    archivePath: args.archivePath,
    archiveUrl: args.archiveUrl,
  });

  const result =
    archive.kind === 'v4'
      ? await importV4(archive, args, supabase, state)
      : await importV3(archive, args, supabase, state);

  const skipNote = result.skipped ? ` skipped=${result.skipped}` : '';
  log(`\nDone. success=${result.okCount} failed=${result.failed.size} total=${result.total}${skipNote}`);
  if (result.failed.size) {
    log(`Retry failed books:\n  npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --with-elasticsearch --import-pages --retry-failed`);
  }
  if (result.okCount === 0 && result.skipped === result.total) {
    log(
      'All books were skipped. To import readable pages into existing catalog entries, run:\n' +
        '  npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --with-elasticsearch --import-pages'
    );
  }
  if (result.failed.size) {
    log(`Failed book ids: ${[...result.failed].slice(0, 30).join(', ')}${result.failed.size > 30 ? '…' : ''}`);
  }
}

function pathBasename(p) {
  return p.split(/[/\\]/).pop();
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
