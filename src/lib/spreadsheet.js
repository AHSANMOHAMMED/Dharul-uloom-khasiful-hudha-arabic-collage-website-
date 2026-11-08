/**
 * Spreadsheet import/export (XLSX + CSV).
 * exceljs is loaded on demand so ordinary pages do not download it.
 *
 * Column shape used throughout: { key, label, width?, type?: 'text'|'number'|'date'|'money'|'percent' }
 */

const loadExcel = () => import('exceljs').then((m) => m.default || m);

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const NUMFMT = { number: '#,##0.##', money: '#,##0.00', percent: '0.0"%"', date: 'yyyy-mm-dd' };

function cellValue(v, type) {
  if (v === null || v === undefined || v === '') return null;
  if (type === 'date') {
    const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v);
    return Number.isNaN(d.getTime()) ? String(v) : d;
  }
  if (type === 'number' || type === 'money' || type === 'percent') {
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return Array.isArray(v) ? v.join(', ') : v;
}

/**
 * Export one or more sheets to an .xlsx file.
 * sheets: [{ name, title?, subtitle?, columns, rows }]
 */
export async function exportXlsx({ filename, sheets, rtl = false, author = 'Kashiful Hudha ERP' }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = author;
  wb.created = new Date();

  for (const sheet of sheets) {
    // Excel sheet names: max 31 chars, no []:*?/\
    const name = String(sheet.name || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: rtl, state: 'frozen', ySplit: sheet.title ? 3 : 1 }] });
    let headerRow = 1;
    if (sheet.title) {
      ws.addRow([sheet.title]).font = { bold: true, size: 14, color: { argb: 'FF0B3B2E' } };
      ws.addRow([sheet.subtitle || '']).font = { italic: true, size: 10, color: { argb: 'FF4A5E56' } };
      headerRow = 3;
    }
    const header = ws.addRow(sheet.columns.map((c) => c.label));
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11694A' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    for (const r of sheet.rows) {
      ws.addRow(sheet.columns.map((c) => cellValue(r[c.key], c.type)));
    }
    sheet.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width || Math.min(40, Math.max(10, String(c.label).length + 4));
      if (NUMFMT[c.type]) col.numFmt = NUMFMT[c.type];
    });
    if (sheet.rows.length) {
      ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: sheet.columns.length } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  );
}

/** CSV with a UTF-8 BOM so Excel shows Arabic/Tamil correctly. */
export function exportCsv({ filename, columns, rows }) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))];
  triggerDownload(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Template for an import: header row of keys, a hint row and an example row.
 * fields: [{ key, label, required?, hint?, example? }]
 */
export async function downloadImportTemplate({ filename, fields, sheetName = 'Import' }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  const head = ws.addRow(fields.map((f) => f.key));
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((cell, i) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fields[i - 1].required ? 'FF0B3B2E' : 'FF11694A' } };
    cell.note = [fields[i - 1].label, fields[i - 1].required ? 'Required' : 'Optional', fields[i - 1].hint].filter(Boolean).join('\n');
  });
  ws.addRow(fields.map((f) => f.example ?? '')).font = { italic: true, color: { argb: 'FF4A5E56' } };
  fields.forEach((f, i) => {
    ws.getColumn(i + 1).width = Math.max(14, f.key.length + 4);
    ws.getColumn(i + 1).numFmt = '@'; // text, so 0771234567 keeps its leading zero
  });
  const help = wb.addWorksheet('Help');
  help.addRow(['Column', 'Required', 'Description']).font = { bold: true };
  fields.forEach((f) => help.addRow([f.key, f.required ? 'Yes' : 'No', [f.label, f.hint].filter(Boolean).join(' — ')]));
  help.getColumn(1).width = 22;
  help.getColumn(3).width = 80;
  help.addRow([]);
  help.addRow(['Delete the example row before importing. Dates: YYYY-MM-DD.']);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

/** "Date of Birth" / "date-of-birth" / "DATE_OF_BIRTH" → "date_of_birth" */
export function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

function excelCellToString(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // Dates typed in Excel come back as UTC midnight.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'object') {
    if ('result' in v) return excelCellToString(v.result); // formula
    if ('text' in v) return String(v.text); // hyperlink
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text).join('');
    return '';
  }
  return String(v).trim();
}

/** Minimal RFC-4180 CSV parser (quoted fields, commas/newlines inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Read the first sheet of an .xlsx or a .csv file.
 * Returns { headers: string[] (normalised), rows: object[] } with empty rows dropped.
 */
export async function readSpreadsheet(file) {
  const name = (file?.name || '').toLowerCase();
  let matrix;
  if (name.endsWith('.csv')) {
    matrix = parseCsv(await file.text());
  } else if (name.endsWith('.xlsx')) {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('The workbook has no sheets');
    matrix = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      for (let c = 1; c <= ws.columnCount; c += 1) values.push(excelCellToString(row.getCell(c).value));
      matrix.push(values);
    });
  } else {
    throw new Error('Upload an .xlsx or .csv file');
  }
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = matrix[0].map(normalizeHeader);
  const rows = matrix
    .slice(1)
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').toString().trim()]).filter(([h]) => h)))
    .filter((r) => Object.values(r).some((v) => v !== ''));
  return { headers, rows };
}
