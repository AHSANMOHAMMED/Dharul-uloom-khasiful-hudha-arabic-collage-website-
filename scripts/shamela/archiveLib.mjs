// Offline Shamela archive helpers (v3 .bok or v4 SQLite zip from Internet Archive).
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { cleanPage } from './lib.mjs';
import {
  detectV4Archive,
  ensureV4DatabaseExtracted,
  extractZipPrefixes,
  loadV4Catalog,
} from './v4Archive.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.env.PYTHON || 'python3';
const EXTRACT_SCRIPT = path.join(__dirname, 'extractShamelaZip.py');
const MDB_ENV = { ...process.env, MDB_JET3_CHARSET: 'cp1256' };
const MAX_BUFFER = 512 * 1024 * 1024;

export const ARCHIVE_CACHE_DIR = path.join(process.cwd(), '.cache', 'shamela');
export const ARCHIVE_STATE_FILE = path.join(process.cwd(), 'scripts', 'shamela', '.import-archive-state.json');

export const DEFAULT_ARCHIVE_URL =
  'https://archive.org/download/shamela_ps/shamela_1441_113_full.zip';

/** Human-readable Archive.org page (use if download link fails). */
export const DEFAULT_ARCHIVE_PAGE = 'https://archive.org/details/shamela_ps';

export async function checkMdbTools() {
  await execFileAsync('mdb-export', ['--version'], { env: MDB_ENV });
}

/** Minimal RFC4180-ish CSV parser for mdb-export output. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      if (ch === '\r') i += 1;
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c.length)) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });
}

export async function listMdbTables(mdbPath) {
  const { stdout } = await execFileAsync('mdb-tables', ['-1', mdbPath], {
    env: MDB_ENV,
    maxBuffer: MAX_BUFFER,
  });
  return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function exportMdbTable(mdbPath, tableName) {
  const { stdout } = await execFileAsync('mdb-export', [mdbPath, tableName], {
    env: MDB_ENV,
    maxBuffer: MAX_BUFFER,
  });
  return parseCsv(stdout);
}

export function bookIdFromTables(tables) {
  for (const t of tables) {
    const m = /^b(\d+)$/i.exec(t);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Parse one Shamela .bok file into metadata + pages. */
export async function parseBokFile(bokPath) {
  const tables = await listMdbTables(bokPath);
  if (!tables.length) throw new Error('No tables found');

  let bkId = bookIdFromTables(tables);
  const mainTable = tables.find((t) => /^main$/i.test(t));
  if (!mainTable) throw new Error('Missing Main table');

  const mainRows = await exportMdbTable(bokPath, mainTable);
  if (!mainRows.length) throw new Error('Empty Main table');
  const main = mainRows[0];
  bkId = bkId || Number(main.BkId || main.bkid || main.ID || 0);
  if (!bkId) throw new Error('Could not determine book id');

  const nashTable = tables.find((t) => t.toLowerCase() === `b${bkId}`.toLowerCase());
  const titleTable = tables.find((t) => t.toLowerCase() === `t${bkId}`.toLowerCase());

  const nashRows = nashTable ? await exportMdbTable(bokPath, nashTable) : [];
  const pages = nashRows
    .map((row, idx) => {
      const raw = row.nass ?? row.Nass ?? row.text ?? '';
      const { body } = cleanPage(String(raw));
      return {
        page_index: Number(row.id ?? row.ID ?? idx + 1),
        page_label: row.page != null ? String(row.page) : row.Page != null ? String(row.Page) : null,
        part: row.part != null ? String(row.part) : row.Part != null ? String(row.Part) : null,
        content: body,
      };
    })
    .filter((p) => p.content)
    .sort((a, b) => a.page_index - b.page_index);

  return {
    bkId,
    title: String(main.Bk ?? main.bk ?? main.title ?? `كتاب ${bkId}`).trim(),
    authorName: String(main.Auth ?? main.auth ?? '').trim(),
    authorId: Number(main.oAuth ?? main.oauth ?? 0) || null,
    categoryName: String(main.cat ?? main.Cat ?? '').trim(),
    year: parseYear(main.HigriD ?? main.AD ?? main.ad),
    description: String(main.Inf ?? main.inf ?? main.Betaka ?? '').trim() || null,
    pages,
    sourcePath: bokPath,
  };
}

function parseYear(value) {
  const n = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0 || n >= 99999) return null;
  return n;
}

export function categorySlug(name) {
  const base = name.trim() || 'uncategorized';
  const hash = createHash('md5').update(base).digest('hex').slice(0, 10);
  return `sh-${hash}`;
}

/** Recursively find .bok files under an extracted archive root. */
export function findBokFiles(rootDir) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.bok$/i.test(entry.name)) results.push(full);
    }
  }
  walk(rootDir);
  return results.sort((a, b) => {
    const na = parseInt(path.basename(a, path.extname(a)), 10);
    const nb = parseInt(path.basename(b, path.extname(b)), 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export async function downloadFile(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      'curl',
      ['-L', '--fail', '--retry', '3', '-A', 'Mozilla/5.0', '-o', destPath, url],
      { stdio: 'inherit' }
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Download failed (curl exit ${code}). Download the zip manually and pass --archive-path.`));
    });
  });

  const fd = fs.openSync(destPath, 'r');
  const probe = Buffer.alloc(512);
  fs.readSync(fd, probe, 0, 512, 0);
  fs.closeSync(fd);
  const head = probe.toString('utf8');
  if (head.includes('<!DOCTYPE html') || head.includes('Item not available')) {
    fs.unlinkSync(destPath);
    throw new Error(
      'Archive.org returned "Item not available". Use the shamela_ps collection instead:\n' +
        '  Browse: https://archive.org/details/shamela_ps\n' +
        '  Download: https://archive.org/download/shamela_ps/shamela_1441_113_full.zip\n' +
        '  Then: npm run import:shamela:archive -- --archive-path /path/to/file.zip'
    );
  }
  return destPath;
}

/** Extract zip via Python (macOS unzip fails on Archive.org Shamela zips). */
export async function extractZip(zipPath, destDir, prefixes = []) {
  fs.mkdirSync(destDir, { recursive: true });
  const args = [EXTRACT_SCRIPT, zipPath, destDir];
  for (const p of prefixes) args.push('--prefix', p);
  await new Promise((resolve, reject) => {
    const child = spawn(PYTHON, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(destDir);
      else reject(new Error(`Zip extraction failed (exit ${code}). Use Python 3 and a valid archive zip.`));
    });
  });
  return destDir;
}

export async function resolveArchiveRoot({ archivePath, archiveUrl, extractDir }) {
  fs.mkdirSync(ARCHIVE_CACHE_DIR, { recursive: true });

  let zipPath = archivePath;
  if (!zipPath) {
    zipPath = path.join(ARCHIVE_CACHE_DIR, path.basename(new URL(archiveUrl || DEFAULT_ARCHIVE_URL).pathname));
  }
  if (!fs.existsSync(zipPath)) {
    if (!archiveUrl && !archivePath) archiveUrl = DEFAULT_ARCHIVE_URL;
    if (archiveUrl) {
      console.log(`⇣ Downloading archive (this may take a long time)...\n   ${archiveUrl}`);
      await downloadFile(archiveUrl, zipPath);
    } else {
      throw new Error(`Archive not found: ${zipPath}`);
    }
  }

  const isV4 = await detectV4Archive(zipPath);
  if (isV4) {
    const root = extractDir || path.join(ARCHIVE_CACHE_DIR, 'v4');
    const masterPath = await ensureV4DatabaseExtracted(zipPath, root);
    const catalog = await loadV4Catalog(masterPath);
    return {
      kind: 'v4',
      root,
      zipPath,
      masterPath,
      catalog,
      books: catalog.books,
    };
  }

  await checkMdbTools();
  const root = extractDir || path.join(ARCHIVE_CACHE_DIR, 'extracted-v3');
  const marker = path.join(root, '.extracted.ok');
  if (!fs.existsSync(marker)) {
    console.log(`⇣ Extracting ${zipPath} → ${root} (Shamela v3 .bok)`);
    await extractZip(zipPath, root);
    fs.writeFileSync(marker, new Date().toISOString());
  }

  const bokFiles = findBokFiles(root);
  if (!bokFiles.length) {
    throw new Error(`No .bok files found under ${root}. If this is a v4 zip, it should contain shamela_4/database/master.db.`);
  }
  return { kind: 'v3', root, zipPath, bokFiles };
}

export function loadArchiveState() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVE_STATE_FILE, 'utf8'));
  } catch {
    return { importedBookIds: [], failedBookIds: [], updatedAt: null };
  }
}

export function saveArchiveState(state) {
  fs.writeFileSync(
    ARCHIVE_STATE_FILE,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
  );
}
