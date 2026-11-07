/**
 * CSV parsing for Arabic–Tamil lexicon imports (browser + Node CLI).
 * Expected header: arabic,tamil,english,root,part_of_speech (any order;
 * extra columns example_ar, example_ta are accepted).
 */

export const DICTIONARY_POS = ['noun', 'verb', 'particle', 'adjective', 'phrase', 'name', 'other'];
const FIELDS = ['arabic', 'tamil', 'english', 'root', 'part_of_speech', 'example_ar', 'example_ta'];

/** RFC 4180-ish CSV → array of string arrays (handles quotes, "" escapes, CRLF, BOM). */
export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/**
 * Parse a lexicon CSV into dictionary_entries rows (without source/verified).
 * Rows without arabic or tamil are dropped; duplicates (same arabic + tamil) are merged.
 */
export function parseDictionaryCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!header.includes('arabic') || !header.includes('tamil')) {
    throw new Error('CSV header must include the columns "arabic" and "tamil" (arabic,tamil,english,root,part_of_speech).');
  }
  const idx = Object.fromEntries(FIELDS.map((f) => [f, header.indexOf(f)]));
  const seen = new Set();
  const out = [];
  for (const r of rows.slice(1)) {
    const get = (f) => (idx[f] >= 0 ? String(r[idx[f]] ?? '').trim() : '');
    const arabic = get('arabic');
    const tamil = get('tamil');
    if (!arabic || !tamil) continue;
    const key = `${arabic}\u0000${tamil}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pos = get('part_of_speech').toLowerCase();
    out.push({
      arabic: arabic.slice(0, 200),
      tamil: tamil.slice(0, 1000),
      english: get('english') || null,
      root: get('root') || null,
      part_of_speech: DICTIONARY_POS.includes(pos) ? pos : null,
      example_ar: get('example_ar') || null,
      example_ta: get('example_ta') || null,
    });
  }
  return out;
}
