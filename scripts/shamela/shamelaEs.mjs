// Query Shamela v4 page text from the bundled Elasticsearch index (offline archive).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { cleanPage } from './lib.mjs';
import { ensureV4ElasticsearchExtracted, makeElasticExecutables, v4EsRoot } from './v4Archive.mjs';

const ES_PORT = Number(process.env.SHAMELA_ES_PORT || 19200);
const ES_HOST = process.env.SHAMELA_ES_HOST || `http://127.0.0.1:${ES_PORT}`;
const PAGE_INDEX = 'page';
const JAVA11_HOME = '/opt/homebrew/opt/openjdk@11/libexec/openjdk.jdk/Contents/Home';

let esProcess = null;
let esStarting = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveJavaHome(elasticHome) {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin/java'))) {
    return process.env.JAVA_HOME;
  }
  if (process.platform === 'darwin' && fs.existsSync(path.join(JAVA11_HOME, 'bin/java'))) {
    return JAVA11_HOME;
  }
  const bundledMac = path.join(elasticHome, 'jdk.app/Contents/Home');
  if (fs.existsSync(path.join(bundledMac, 'bin/java'))) return bundledMac;
  const bundledWin = path.join(elasticHome, 'jdk');
  if (fs.existsSync(path.join(bundledWin, 'bin/java'))) return bundledWin;
  throw new Error(
    'Java 11+ is required to run Shamela Elasticsearch on macOS. Install with: brew install openjdk@11'
  );
}

/** Shamela ES 7.6 jvm.options uses flags incompatible with many JDKs on macOS. */
function patchJvmOptionsForMac(elasticHome) {
  if (process.platform !== 'darwin') return;
  const marker = path.join(elasticHome, 'config', '.jvm-patched-mac');
  if (fs.existsSync(marker)) return;

  const jvmPath = path.join(elasticHome, 'config/jvm.options');
  const lines = fs.readFileSync(jvmPath, 'utf8').split('\n');
  const patched = lines.map((line) => {
    const t = line.trim();
    if (
      t.startsWith('-Xlog') ||
      t.includes('Xloggc') ||
      t.includes('UseConcMarkSweepGC') ||
      t.includes('CMSInitiating') ||
      t.includes('UseCMSInitiating')
    ) {
      return `# ${line}`;
    }
    return line;
  });
  fs.writeFileSync(jvmPath, `${patched.join('\n')}\n`);
  fs.writeFileSync(marker, new Date().toISOString());
}

async function waitForElasticsearch(maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${ES_HOST}/_cluster/health?wait_for_status=yellow&timeout=30s`);
      if (res.ok) {
        const body = await res.json();
        if (body.status === 'yellow' || body.status === 'green') return;
      }
    } catch {
      /* not ready */
    }
    await sleep(2000);
  }
  throw new Error(
    `Elasticsearch did not become ready at ${ES_HOST}. On macOS run: brew install openjdk@11`
  );
}

export async function startElasticsearch(extractRoot) {
  if (await esHealthy()) {
    console.log(`Elasticsearch already running at ${ES_HOST} (reusing existing node).`);
    return;
  }
  if (esProcess) return;
  if (esStarting) return esStarting;

  esStarting = (async () => {
    const { elasticHome } = v4EsRoot(extractRoot);
    const bin =
      process.platform === 'win32'
        ? path.join(elasticHome, 'bin', 'elasticsearch.bat')
        : path.join(elasticHome, 'bin', 'elasticsearch');
    if (!fs.existsSync(bin)) {
      throw new Error(`Elasticsearch binary not found: ${bin}`);
    }
    makeElasticExecutables(elasticHome);
    patchJvmOptionsForMac(elasticHome);

    const javaHome = resolveJavaHome(elasticHome);
    const env = {
      ...process.env,
      JAVA_HOME: javaHome,
      ES_JAVA_OPTS: process.env.ES_JAVA_OPTS || '-Xms512m -Xmx2g',
    };

    await new Promise((resolve, reject) => {
      esProcess = spawn(
        bin,
        ['-Ehttp.port=' + ES_PORT, '-Ediscovery.type=single-node', '-Expack.security.enabled=false'],
        { cwd: elasticHome, env, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      esProcess.on('error', reject);
      esProcess.on('spawn', resolve);
    });

    esProcess.stdout?.on('data', (d) => {
      const s = d.toString();
      if (s.includes('ERROR') || s.includes('started')) process.stdout.write(s);
    });
    esProcess.stderr?.on('data', (d) => process.stderr.write(d));
    esProcess.on('exit', () => {
      esProcess = null;
    });

    try {
      await waitForElasticsearch();
    } catch (startErr) {
      if (await esHealthy()) {
        console.log(`Elasticsearch started elsewhere on ${ES_HOST} (reusing).`);
        return;
      }
      throw startErr;
    }
  })();

  try {
    await esStarting;
  } finally {
    esStarting = null;
  }
}

export function stopElasticsearch() {
  if (esProcess) {
    esProcess.kill('SIGTERM');
    esProcess = null;
  }
}

async function esHealthy() {
  try {
    const res = await fetch(`${ES_HOST}/_cluster/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.status === 'yellow' || body.status === 'green';
  } catch {
    return false;
  }
}

async function esSearch(body) {
  if (!(await esHealthy())) {
    throw new Error(`Elasticsearch not reachable at ${ES_HOST}`);
  }
  const res = await fetch(`${ES_HOST}/${PAGE_INDEX}/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ES search failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

function parseHitId(hit) {
  const m = /^p-(\d+)-(\d+)$/.exec(String(hit._id ?? ''));
  if (m) return Number(m[2]);
  return Number(hit._source?.page_id ?? 0) || 0;
}

function mapHit(hit) {
  const src = hit._source || {};
  const raw = src.page ?? src.content ?? src.body ?? src.text ?? src.nass ?? '';
  const { body } = cleanPage(String(raw));
  if (!body) return null;
  const pageIndex = parseHitId(hit);
  return {
    page_index: pageIndex || 1,
    page_label: src.page_number != null ? String(src.page_number) : null,
    part: src.part != null ? String(src.part) : null,
    content: body,
  };
}

async function fetchAllPages(bookId) {
  const pages = [];
  const data = await esSearch({
    query: { term: { book_id: bookId } },
    size: 10000,
    sort: [{ page_id: 'asc' }],
    _source: ['page', 'page_id', 'page_number', 'part'],
  });

  const seen = new Set();
  for (const hit of data.hits?.hits || []) {
    const p = mapHit(hit);
    if (!p) continue;
    let idx = p.page_index;
    while (seen.has(idx)) idx += 1;
    p.page_index = idx;
    seen.add(idx);
    pages.push(p);
  }

  const total = data.hits?.total?.value ?? pages.length;
  if (total > 10000) {
    console.warn(`  ⚠ book ${bookId} has ${total} pages; only first 10000 imported`);
  }

  pages.sort((a, b) => a.page_index - b.page_index);
  return pages;
}

/** Fetch all pages for a Shamela book id from the offline ES `page` index. */
export async function fetchBookPagesFromEs(bookId, extractRoot, zipPath) {
  await ensureV4ElasticsearchExtracted(zipPath, extractRoot);
  if (!(await esHealthy())) await startElasticsearch(extractRoot);
  const pages = await fetchAllPages(bookId);
  if (!pages.length) {
    throw new Error(`No pages found in Elasticsearch for book_id=${bookId}`);
  }
  return pages;
}

process.on('exit', () => stopElasticsearch());
