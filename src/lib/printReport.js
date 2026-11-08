/**
 * Print-ready A4 documents with the college letterhead. The browser's print
 * dialog saves them as PDF ("Save as PDF" / "Microsoft Print to PDF") on any
 * device, with correct Arabic/Tamil shaping (client PDF libraries cannot
 * shape Arabic without embedding large fonts).
 */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function formatCell(v, type) {
  if (v === null || v === undefined || v === '') return '—';
  if (type === 'money') return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'number') return Number(v).toLocaleString();
  if (type === 'percent') return `${Number(v).toFixed(1)}%`;
  if (type === 'date') return String(v).slice(0, 10);
  if (typeof v === 'boolean') return v ? '✓' : '—';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

const LETTERHEAD = {
  en: 'D.U. Kashiful Hudha Arabic College',
  ar: 'دار العلوم كاشف الهدى العربية',
  place: 'Mudalaippali, Kalpitiya, Sri Lanka',
};

function shell({ title, body, dir, lang, orientation, generatedBy, meta }) {
  const now = new Date();
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans", "Noto Naskh Arabic", "Noto Sans Tamil", "Segoe UI", Arial, sans-serif; color: #14201B; font-size: 10.5pt; margin: 0; }
  .lh { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0B3B2E; padding-bottom: 8px; margin-bottom: 4px; }
  .lh img { width: 54px; height: 54px; object-fit: contain; }
  .lh .n-en { font-size: 15pt; font-weight: 700; color: #0B3B2E; }
  .lh .n-ar { font-size: 14pt; font-weight: 700; color: #0B3B2E; font-family: "Noto Naskh Arabic", "Amiri", serif; }
  .lh .place { font-size: 9pt; color: #4A5E56; }
  .gold { height: 3px; background: #C29A3A; margin-bottom: 12px; }
  h1 { font-size: 14pt; margin: 6px 0 2px; color: #0B3B2E; }
  .meta { font-size: 9pt; color: #4A5E56; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #0B3B2E; color: #fff; font-weight: 600; text-align: start; padding: 5px 6px; font-size: 9pt; }
  td { border-bottom: 1px solid #E8E1D0; padding: 4px 6px; font-size: 9pt; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #FBF8F0; }
  td.num { text-align: end; font-variant-numeric: tabular-nums; }
  /* Grand totals print once, after the last row (not repeated on every page). */
  tfoot { display: table-row-group; }
  tfoot td { font-weight: 700; border-top: 2px solid #0B3B2E; }
  .kv { width: 100%; }
  .kv td:first-child { width: 32%; color: #4A5E56; }
  h2 { font-size: 11pt; color: #11694A; margin: 14px 0 4px; border-bottom: 1px solid #E8E1D0; padding-bottom: 2px; }
  .foot { margin-top: 14px; padding-top: 4px; border-top: 1px solid #E8E1D0; font-size: 8pt; color: #4A5E56; display: flex; justify-content: space-between; }
  .sign { margin-top: 36px; display: flex; justify-content: space-between; gap: 24px; }
  .sign div { flex: 1; border-top: 1px dotted #4A5E56; padding-top: 4px; text-align: center; font-size: 9pt; color: #4A5E56; }
  @media screen { body { background: #e5e5e5; } .page { background: #fff; max-width: ${orientation === 'landscape' ? '297mm' : '210mm'}; margin: 12px auto; padding: 14mm 12mm; box-shadow: 0 2px 10px rgba(0,0,0,.15); } }
</style>
</head>
<body>
<div class="page">
  <div class="lh">
    <img src="${esc(window.location.origin)}/images/logo.svg" alt="">
    <div>
      <div class="n-en">${esc(LETTERHEAD.en)}</div>
      <div class="n-ar" dir="rtl">${esc(LETTERHEAD.ar)}</div>
      <div class="place">${esc(LETTERHEAD.place)}</div>
    </div>
  </div>
  <div class="gold"></div>
  <h1>${esc(title)}</h1>
  ${meta ? `<div class="meta">${meta}</div>` : ''}
  ${body}
  <div class="foot"><span>${esc(generatedBy || '')}</span><span>${esc(now.toLocaleString())}</span></div>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 300); });</script>
</body>
</html>`;
}

function openAndPrint(html) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups for this site to print or save as PDF');
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}

/**
 * Tabular report. columns: [{ key, label, type? }]; totals: { key: value }.
 * filters: [[label, value], …] shown under the title.
 */
export function printTable({ title, columns, rows, filters = [], totals = null, dir = 'ltr', lang = 'en', orientation, generatedBy, signatures = [] }) {
  const orient = orientation || (columns.length > 7 ? 'landscape' : 'portrait');
  const isNum = (c) => ['money', 'number', 'percent'].includes(c.type);
  const head = `<tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td class="${isNum(c) ? 'num' : ''}">${esc(formatCell(r[c.key], c.type))}</td>`).join('')}</tr>`)
    .join('');
  const foot = totals
    ? `<tfoot><tr>${columns.map((c) => `<td class="${isNum(c) ? 'num' : ''}">${c.key in totals ? esc(formatCell(totals[c.key], c.type)) : ''}</td>`).join('')}</tr></tfoot>`
    : '';
  const meta = [...filters.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`), `<b>${rows.length}</b> ${esc(lang === 'ar' ? 'سجل' : 'records')}`].join(' &nbsp;·&nbsp; ');
  const sign = signatures.length ? `<div class="sign">${signatures.map((s) => `<div>${esc(s)}</div>`).join('')}</div>` : '';
  return openAndPrint(
    shell({ title, dir, lang, orientation: orient, generatedBy, meta, body: `<table><thead>${head}</thead><tbody>${body}</tbody>${foot}</table>${sign}` })
  );
}

/** Profile / record sheet. sections: [{ title, items: [[label, value], …] }] */
export function printRecord({ title, subtitle, sections, dir = 'ltr', lang = 'en', generatedBy, signatures = [] }) {
  const body = sections
    .map(
      (s) =>
        `<h2>${esc(s.title)}</h2><table class="kv"><tbody>${s.items
          .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(formatCell(v))}</td></tr>`)
          .join('')}</tbody></table>`
    )
    .join('');
  const sign = signatures.length ? `<div class="sign">${signatures.map((s) => `<div>${esc(s)}</div>`).join('')}</div>` : '';
  return openAndPrint(shell({ title, dir, lang, orientation: 'portrait', generatedBy, meta: subtitle ? esc(subtitle) : '', body: body + sign }));
}

/**
 * Print a rich-text document on its letterhead.
 *
 * Chromium does not paint page content into @page margins, so the page has no
 * margins: the letterhead image is pinned (position: fixed → repeated on every
 * printed page) and the writable area is reserved on every page by the
 * repeating <thead>/<tfoot> spacer rows of a layout table, with the side
 * margins as cell padding. html must already be sanitised.
 */
export function printDocument({ title, html, letterhead = null, dir = 'ltr', lang = 'en', watermark = '' }) {
  const m = {
    top: letterhead?.margin_top_mm ?? 20,
    bottom: letterhead?.margin_bottom_mm ?? 20,
    left: letterhead?.margin_left_mm ?? 20,
    right: letterhead?.margin_right_mm ?? 20,
  };
  const landscape = letterhead?.orientation === 'landscape';
  const W = landscape ? 297 : 210;
  const H = landscape ? 210 : 297;
  const bg = letterhead?.url ? `<img class="lh-bg" src="${esc(letterhead.url)}" alt="">` : '';
  const wm = watermark ? `<div class="wm">${esc(watermark)}</div>` : '';
  const doc = `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
  html, body { margin: 0; }
  body { font-family: "Noto Sans", "Noto Naskh Arabic", "Noto Sans Tamil", "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lh-bg { position: fixed; top: 0; left: 0; width: ${W}mm; height: ${H}mm; object-fit: fill; z-index: 0; }
  .wm { position: fixed; top: 45%; left: 0; width: ${W}mm; text-align: center; font-size: 56pt; color: rgba(185, 28, 28, .12);
        transform: rotate(-30deg); z-index: 1; font-weight: 700; pointer-events: none; }
  table.layout { width: ${W}mm; border-collapse: collapse; position: relative; z-index: 2; }
  table.layout > thead td { height: ${m.top}mm; padding: 0; border: 0; }
  table.layout > tfoot td { height: ${m.bottom}mm; padding: 0; border: 0; }
  table.layout > tbody > tr > td.content { padding: 0 ${dir === 'rtl' ? m.left : m.right}mm 0 ${dir === 'rtl' ? m.right : m.left}mm; border: 0; vertical-align: top; }
  .content table { border-collapse: collapse; width: 100%; }
  .content td, .content th { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
  .content img { max-width: 100%; }
  .content h1, .content h2, .content h3 { page-break-after: avoid; }
  .content tr, .content li { page-break-inside: avoid; }
  @media screen {
    body { background: #e5e5e5; }
    .sheet { background: #fff; width: ${W}mm; min-height: ${H}mm; margin: 12px auto; box-shadow: 0 2px 10px rgba(0,0,0,.15); position: relative; overflow: hidden; }
    .lh-bg, .wm { position: absolute; }
  }
</style>
</head>
<body>
<div class="sheet">${bg}${wm}
<table class="layout">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td></td></tr></tfoot>
  <tbody><tr><td class="content">${html}</td></tr></tbody>
</table>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 400); });</script>
</body>
</html>`;
  return openAndPrint(doc);
}
