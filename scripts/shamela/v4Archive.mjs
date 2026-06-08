// Shamela v4 archive (Internet Archive shamela_ps zip): SQLite catalog + optional Elasticsearch text.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ARCHIVE_CACHE_DIR } from './archiveLib.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.env.PYTHON || 'python3';
const EXTRACT_SCRIPT = path.join(__dirname, 'extractShamelaZip.py');
const SQLITE_SCRIPT = path.join(__dirname, 'v4Sqlite.py');

export const V4_DB_PREFIX = 'shamela_4/database/';
export const V4_ES_PREFIXES = ['shamela_4/elastic/', 'shamela_4/text/'];

export function bookDbRelPath(bookId) {
  const folder = String(bookId % 1000).padStart(3, '0');
  return `shamela_4/database/book/${folder}/${bookId}.db`;
}

export async function zipHasPrefix(zipPath, prefix) {
  const { stdout } = await execFileAsync(
    PYTHON,
    [
      '-c',
      `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); sys.exit(0 if any(n.startswith(sys.argv[2]) for n in z.namelist()) else 1)`,
      zipPath,
      prefix,
    ],
    { maxBuffer: 64 * 1024 }
  );
  return stdout !== undefined;
}

export async function detectV4Archive(zipPath) {
  try {
    await execFileAsync(
      PYTHON,
      [
        '-c',
        `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); sys.exit(0 if any(n.endswith('database/master.db') for n in names) else 1)`,
      zipPath,
      ],
      { maxBuffer: 64 * 1024 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function extractZipPrefixes(zipPath, destDir, prefixes) {
  const args = [EXTRACT_SCRIPT, zipPath, destDir];
  for (const p of prefixes) args.push('--prefix', p);
  await new Promise((resolve, reject) => {
    const child = spawn(PYTHON, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`extractShamelaZip.py failed with code ${code}`));
    });
  });
}

export async function ensureV4DatabaseExtracted(zipPath, extractRoot) {
  const marker = path.join(extractRoot, '.v4-database.ok');
  const masterPath = path.join(extractRoot, 'shamela_4/database/master.db');
  if (fs.existsSync(marker) && fs.existsSync(masterPath)) {
    return masterPath;
  }
  console.log(`⇣ Extracting Shamela v4 database/ from zip (≈0.6 GB uncompressed)…`);
  await extractZipPrefixes(zipPath, extractRoot, [V4_DB_PREFIX]);
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Expected master.db at ${masterPath}`);
  }
  fs.writeFileSync(marker, new Date().toISOString());
  return masterPath;
}

export async function loadV4Catalog(masterDbPath) {
  const { stdout } = await execFileAsync(PYTHON, [SQLITE_SCRIPT, 'catalog', masterDbPath], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function readBookPagesFromDb(bookDbPath) {
  const { stdout } = await execFileAsync(PYTHON, [SQLITE_SCRIPT, 'pages', bookDbPath], {
    maxBuffer: 512 * 1024 * 1024,
  });
  const { pages } = JSON.parse(stdout);
  return pages.filter((p) => p.content);
}

export function resolveBookDbPath(extractRoot, bookId) {
  return path.join(extractRoot, bookDbRelPath(bookId));
}

export async function readBookPagesFromZip(zipPath, bookId) {
  const rel = bookDbRelPath(bookId);
  const { stdout } = await execFileAsync(
    PYTHON,
    [
      '-c',
      `
import json, sqlite3, sys, tempfile, zipfile, os
zip_path, entry = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as z:
    data = z.read(entry)
fd, tmp = tempfile.mkstemp(suffix='.db')
os.write(fd, data)
os.close(fd)
conn = sqlite3.connect(tmp)
pages = []
for row_id, part, page, number, services in conn.execute(
    'SELECT id, part, page, number, services FROM page ORDER BY id'
):
    content = str(services).strip() if services else ''
    if content:
        pages.append({
            'page_index': int(row_id),
            'page_label': str(page) if page is not None else None,
            'part': str(part) if part else None,
            'content': content,
        })
conn.close()
os.unlink(tmp)
print(json.dumps({'pages': pages}, ensure_ascii=False))
`,
      zipPath,
      rel,
    ],
    { maxBuffer: 512 * 1024 * 1024 }
  );
  const { pages } = JSON.parse(stdout);
  return pages;
}

export function v4EsRoot(extractRoot) {
  return {
    elasticHome: path.join(extractRoot, 'shamela_4/elastic'),
    textData: path.join(extractRoot, 'shamela_4/text'),
    marker: path.join(extractRoot, '.v4-elasticsearch.ok'),
  };
}

/** Zip extract drops execute bits; Elasticsearch and bundled JRE need +x on macOS/Linux. */
export function makeElasticExecutables(elasticHome) {
  const dirs = [
    path.join(elasticHome, 'bin'),
    path.join(elasticHome, 'bin', 'jre', 'bin'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      try {
        if (fs.statSync(full).isFile()) fs.chmodSync(full, 0o755);
      } catch {
        /* ignore */
      }
    }
  }
}

let esExtractPromise = null;

export async function ensureV4ElasticsearchExtracted(zipPath, extractRoot) {
  const { marker, elasticHome } = v4EsRoot(extractRoot);
  const esBin = path.join(elasticHome, 'bin/elasticsearch');
  if (fs.existsSync(marker) && fs.existsSync(esBin)) {
    makeElasticExecutables(elasticHome);
    return;
  }
  if (!esExtractPromise) {
    esExtractPromise = (async () => {
      console.log(
        '⇣ Extracting Shamela v4 text index + Elasticsearch (≈7 GB). This is a one-time step; use --metadata-only to skip.'
      );
      await extractZipPrefixes(zipPath, extractRoot, V4_ES_PREFIXES);
      makeElasticExecutables(elasticHome);
      fs.writeFileSync(marker, new Date().toISOString());
    })();
  }
  await esExtractPromise;
}
