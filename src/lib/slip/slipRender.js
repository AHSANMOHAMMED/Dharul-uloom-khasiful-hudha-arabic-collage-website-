import { toast } from 'react-toastify';
import { tx } from '../tx';
import { getSlipSettings, normalizeSlipSettings } from './slipSettings';

/**
 * One slip model → (a) a formatted page for the Epson LQ-310 driver or a
 * laser printer, sized exactly to the form in the printer, or (b) a raw
 * ESC/P job that uses the printer's own fonts and line-drawing characters.
 *
 * Slip model
 * {
 *   title: 'OFFICIAL RECEIPT', number: 'KH-RCP-2026-000001', date: '07 Nov 2026, 10:15 am',
 *   org: { name_en, name_ar, address, phone, email, registration_no, logo_url },
 *   status: null | 'VOID' | 'REVERSED' | 'DRAFT',
 *   party:   [[label, value], ...]          info block (2 columns on wide forms)
 *   columns: [{ label, align: 'right'|'left', kind: 'text'|'num'|'qty', rawSkip? }]
 *   rows:    [[cell, ...], ...]              already formatted strings
 *   totals:  [{ label, value, strong? }]
 *   words:   'Rupees ... Only'
 *   details: [[label, value], ...]           method, reference, balance ...
 *   notes:   string
 *   signatures: ['Cashier', 'Received by']
 *   footer:  string                          verification link etc.
 * }
 */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const mm = (n) => `${Math.round(n * 10) / 10}mm`;

// ---------------------------------------------------------------------------
// Formatted slip (driver / laser)
// ---------------------------------------------------------------------------
function kvHtml(pairs) {
  return (pairs || [])
    .filter((p) => p && p[1] !== undefined && p[1] !== null && p[1] !== '')
    .map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`)
    .join('');
}

function slipSection(m, s, copyLabel, theme) {
  const org = m.org || {};
  const contact = [org.address, org.phone ? `Tel: ${org.phone}` : null, org.email].filter(Boolean).join('  ·  ');
  const cols = m.columns || [];
  const table = cols.length
    ? `<table class="items"><thead><tr>${cols
        .map((c) => `<th class="${c.align === 'right' ? 'r' : ''}">${esc(c.label)}</th>`)
        .join('')}</tr></thead><tbody>${
        (m.rows || []).length
          ? m.rows.map((r) => `<tr>${r.map((cell, i) => `<td class="${cols[i]?.align === 'right' ? 'r' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${cols.length}">—</td></tr>`
      }</tbody></table>`
    : '';
  const totals = (m.totals || []).length
    ? `<div class="totals">${m.totals
        .map((t) => `<div class="trow${t.strong ? ' grand' : ''}"><span>${esc(t.label)}</span><span>${esc(t.value)}</span></div>`)
        .join('')}</div>`
    : '';
  const logo = s.showLogo && org.logo_url ? `<img class="logo" src="${esc(org.logo_url)}" alt="" />` : '';
  return `<section class="slip ${theme}">
  ${m.status ? `<div class="stamp">${esc(m.status)}</div>` : ''}
  <header class="head">
    ${logo}
    <div class="org">
      <div class="org-name">${esc(org.name_en || 'Institution')}</div>
      ${org.name_ar ? `<div class="org-ar" dir="rtl" lang="ar">${esc(org.name_ar)}</div>` : ''}
      ${contact ? `<div class="contact">${esc(contact)}</div>` : ''}
      ${org.registration_no ? `<div class="contact">Reg. No: ${esc(org.registration_no)}</div>` : ''}
    </div>
    ${copyLabel ? `<div class="copy">${esc(copyLabel)}</div>` : ''}
  </header>
  <div class="titlebar">
    <div class="title">${esc(m.title)}</div>
    <div class="meta">
      ${m.number ? `<span>No.</span><b>${esc(m.number)}</b>` : ''}
      ${m.date ? `<span>Date</span><b>${esc(m.date)}</b>` : ''}
    </div>
  </div>
  ${(m.party || []).length ? `<div class="grid">${kvHtml(m.party)}</div>` : ''}
  ${table}
  ${totals}
  ${m.words ? `<div class="words"><b>Amount in words:</b> ${esc(m.words)}</div>` : ''}
  ${(m.details || []).length ? `<div class="grid">${kvHtml(m.details)}</div>` : ''}
  ${m.notes ? `<div class="notes">${esc(m.notes)}</div>` : ''}
  <div class="sigs">${(m.signatures || ['Authorised signature']).map((x) => `<div class="sig">${esc(x)}</div>`).join('')}</div>
  <div class="foot"><span>${esc(m.footer || '')}</span><span>Printed ${esc(new Date().toLocaleString('en-GB'))}</span></div>
</section>`;
}

function slipCss(s) {
  const W = s.widthMm;
  const H = s.heightMm;
  const M = s.marginMm;
  const F = s.fontPt;
  const narrow = W - 2 * M < 160;
  return `
  @page { size: ${mm(W)} ${mm(H)}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, 'Noto Sans', 'Latha', 'Nirmala UI', sans-serif; color: #000; font-size: ${F}pt; line-height: 1.25; }
  .slip { position: relative; width: ${mm(W)}; min-height: ${mm(H)}; overflow: hidden;
          padding: ${mm(M + s.offsetYmm)} ${mm(Math.max(M - s.offsetXmm, 0))} ${mm(M)} ${mm(M + s.offsetXmm)};
          display: flex; flex-direction: column; }
  .slip:not(:last-of-type) { break-after: page; page-break-after: always; }
  .head { display: flex; align-items: center; gap: 3mm; border-bottom: 2px solid #000; padding-bottom: 1.2mm; }
  .logo { width: 13mm; height: 13mm; object-fit: contain; }
  .org { flex: 1; min-width: 0; text-align: ${narrow ? 'left' : 'center'}; }
  .org-name { font-size: ${F + 3.5}pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .org-ar { font-size: ${F + 3}pt; font-weight: 700; font-family: 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', Arial, serif; }
  .contact { font-size: ${F - 1.5}pt; }
  .copy { border: 1.5px solid #000; padding: .6mm 2mm; font-size: ${F - 2}pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; align-self: flex-start; }
  .titlebar { display: flex; justify-content: space-between; align-items: center; gap: 4mm; margin: 2mm 0 1.6mm; }
  .title { font-size: ${F + 2}pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; border: 1.5px solid #000; padding: .8mm 3mm; }
  .meta { display: grid; grid-template-columns: auto auto; gap: .3mm 2.5mm; font-size: ${F}pt; }
  .grid { display: grid; grid-template-columns: ${narrow ? '1fr' : '1fr 1fr'}; gap: .6mm 6mm; margin-bottom: 1.8mm; }
  .kv { display: flex; gap: 2mm; border-bottom: 1px dotted #000; padding-bottom: .3mm; min-width: 0; }
  .kv .k { flex: 0 0 ${narrow ? '30mm' : '32mm'}; font-weight: 700; }
  .kv .v { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 1.6mm; }
  table.items th, table.items td { border: 1px solid #000; padding: .5mm 1.5mm; text-align: left; vertical-align: top; }
  table.items th { font-weight: 700; font-size: ${F - 0.5}pt; }
  .r { text-align: right !important; white-space: nowrap; }
  .totals { margin-left: auto; width: ${narrow ? '100%' : '78mm'}; margin-bottom: 1.6mm; }
  .trow { display: flex; justify-content: space-between; gap: 3mm; padding: .4mm 1.5mm; }
  .trow.grand { border-top: 2px solid #000; border-bottom: 3px double #000; font-weight: 700; font-size: ${F + 1.5}pt; }
  .words { border: 1px solid #000; padding: .8mm 2mm; margin-bottom: 1.6mm; }
  .notes { font-size: ${F - 1}pt; margin-bottom: 1.4mm; white-space: pre-wrap; }
  .sigs { margin-top: auto; display: flex; justify-content: space-between; gap: 8mm; padding-top: 9mm; }
  .sig { flex: 1; border-top: 1px dotted #000; text-align: center; font-size: ${F - 1}pt; padding-top: .6mm; }
  .foot { display: flex; justify-content: space-between; gap: 4mm; font-size: ${F - 2.5}pt; margin-top: 1.2mm; overflow-wrap: anywhere; }
  .stamp { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-14deg); border: 3px solid #000;
           padding: 1mm 6mm; font-size: 30pt; font-weight: 900; letter-spacing: 6px; color: transparent; -webkit-text-stroke: 1.2px #000; pointer-events: none; }
  /* laser / inkjet colour theme */
  .color { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .color .head { border-color: #1a5c38; }
  .color .org-name, .color .title { color: #1a5c38; }
  .color .org-ar { color: #a8841c; }
  .color .title { border-color: #1a5c38; }
  .color table.items th { background: #1a5c38; color: #fff; border-color: #1a5c38; }
  .color .trow.grand { border-color: #1a5c38; }
  .color .stamp { border-color: #b91c1c; -webkit-text-stroke-color: #b91c1c; }
  /* screen preview */
  @media screen {
    body { background: #d9d9d9; padding: 10px 0 70px; }
    .slip { background: #fff; margin: 0 auto 10px; box-shadow: 0 1px 6px rgba(0,0,0,.25); }
  }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #fff; border-top: 1px solid #bbb; padding: 8px 12px;
         font: 12px Arial, sans-serif; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .bar button { padding: 7px 20px; font-weight: 700; cursor: pointer; }
  @media print { .bar { display: none; } }
`;
}

function printHint(s) {
  const size = `${Math.round(s.widthMm * 10) / 10} × ${Math.round(s.heightMm * 10) / 10} mm`;
  return s.mode === 'lq310'
    ? `Print dialog: printer <b>Epson LQ-310</b> · paper size <b>${size}</b> (create this form in the driver once) · margins <b>None</b> · scale <b>100%</b> · headers and footers <b>off</b>.`
    : `Print dialog: paper size <b>${size}</b> · margins <b>None</b> · scale <b>100%</b>.`;
}

/** Full HTML document for one or more slips. */
export function slipDocument(models, settings) {
  const s = normalizeSlipSettings(settings);
  const list = (Array.isArray(models) ? models : [models]).filter(Boolean);
  const theme = s.mode === 'laser' ? 'color' : 'impact';
  const labels = s.copies === 2 ? ['Office copy', 'Customer copy'] : [''];
  const body = list.flatMap((m) => labels.map((l) => slipSection(m, s, l || m.copyLabel || '', theme))).join('\n');
  const title = list.length === 1 ? `${list[0].title} ${list[0].number || ''}` : `${list[0]?.title || 'Slips'} (${list.length})`;
  return `<!DOCTYPE html>
<html lang="en" dir="ltr"><head><meta charset="UTF-8" /><title>${esc(title.trim())}</title>
<style>${slipCss(s)}</style></head>
<body>
${body}
<div class="bar"><button onclick="window.print()">Print</button><span>${printHint(s)}</span></div>
</body></html>`;
}

/** Alignment test: rulers and corner marks to set the offsets once per printer. */
export function alignmentDocument(settings) {
  const s = normalizeSlipSettings(settings);
  const W = s.widthMm;
  const H = s.heightMm;
  const ticks = [];
  for (let x = 10; x < W; x += 10) ticks.push(`<div style="position:absolute;left:${mm(x + s.offsetXmm)};top:${mm(s.offsetYmm)};height:${x % 50 ? '3mm' : '6mm'};border-left:1px solid #000"></div><div style="position:absolute;left:${mm(x + s.offsetXmm + 0.6)};top:${mm(s.offsetYmm + 6)};font-size:7pt">${x % 50 ? '' : x}</div>`);
  for (let y = 10; y < H; y += 10) ticks.push(`<div style="position:absolute;top:${mm(y + s.offsetYmm)};left:${mm(s.offsetXmm)};width:${y % 50 ? '3mm' : '6mm'};border-top:1px solid #000"></div><div style="position:absolute;top:${mm(y + s.offsetYmm + 0.4)};left:${mm(s.offsetXmm + 7)};font-size:7pt">${y % 50 ? '' : y}</div>`);
  const M = s.marginMm;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Slip alignment test</title>
<style>
  @page { size: ${mm(W)} ${mm(H)}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { position: relative; width: ${mm(W)}; height: ${mm(H)}; overflow: hidden; font-family: Arial, sans-serif; color: #000; }
  .box { position: absolute; left: ${mm(M + s.offsetXmm)}; top: ${mm(M + s.offsetYmm)}; width: ${mm(W - 2 * M)}; height: ${mm(H - 2 * M)}; border: 1.5px solid #000; }
  .msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; font-size: 10pt; width: 80%; }
  @media screen { body { background: #d9d9d9; padding: 10px 0 60px; } .page { background: #fff; margin: 0 auto; } }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #fff; border-top: 1px solid #bbb; padding: 8px 12px; font: 12px Arial; }
  @media print { .bar { display: none; } }
</style></head><body>
<div class="page">${ticks.join('')}
  <div class="box"></div>
  <div class="msg"><b>ALIGNMENT TEST</b> — form ${Math.round(W * 10) / 10} × ${Math.round(H * 10) / 10} mm<br/>
  The box must sit ${M} mm inside every edge of the form. Measure the gap at the left and top edges with a ruler,
  then correct the offsets in Printer settings (+ moves right / down). The ruler marks are every 10 mm.</div>
</div>
<div class="bar"><button onclick="window.print()">Print</button> ${printHint(s)}</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Raw ESC/P (Epson LQ-310, 24-pin)
// ---------------------------------------------------------------------------
/** Printable ASCII only (impact printers in text mode). */
export function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[·•]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const H1 = '─'; // single rule → PC437 0xC4
const H2 = '═'; // double rule → PC437 0xCD
const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const padL = (s, n) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s);
const center = (s, n) => ' '.repeat(Math.max(0, Math.floor((n - s.length) / 2))) + s.slice(0, n);

function wrap(text, width) {
  const words = ascii(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line ? line.length + 1 : 0) + w.length > width) {
      if (line) lines.push(line);
      line = w.slice(0, width);
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function rawColumns(settings) {
  const s = normalizeSlipSettings(settings);
  const inches = (s.widthMm - 2 * s.marginMm) / 25.4;
  return Math.max(40, Math.min(Math.floor(inches * s.cpi), s.cpi === 12 ? 96 : 80));
}

/** Slip → [{ text, bold?, wide? }] fixed-width lines. */
export function slipLines(m, settings) {
  const s = normalizeSlipSettings(settings);
  const W = rawColumns(s);
  const out = [];
  const push = (text, o = {}) => out.push({ text, ...o });
  const rule = (ch = H1) => push(ch.repeat(W));
  const org = m.org || {};

  const name = ascii(org.name_en || 'Institution').toUpperCase();
  if (name.length * 2 <= W) push(center(name, Math.floor(W / 2)), { bold: true, wide: true });
  else wrap(name, W).forEach((l) => push(center(l, W), { bold: true }));
  const contact = [org.address, org.phone ? `Tel ${org.phone}` : null].filter(Boolean).map(ascii).join(' | ');
  if (contact) wrap(contact, W).forEach((l) => push(center(l, W)));
  if (org.registration_no) push(center(`Reg. No: ${ascii(org.registration_no)}`, W));
  rule(H2);
  const no = m.number ? `No. ${ascii(m.number)}` : '';
  push(pad(ascii(m.title).toUpperCase(), W - no.length) + no, { bold: true });
  const date = m.date ? `Date: ${ascii(m.date)}` : '';
  const copy = m.copyLabel ? ascii(m.copyLabel).toUpperCase() : '';
  if (date || copy) push(pad(copy, W - date.length) + date);
  if (m.status) push(center(`*** ${ascii(m.status)} ***`, W), { bold: true });
  rule();

  const kv = (pairs, two) => {
    const list = (pairs || []).filter((p) => p && p[1] !== undefined && p[1] !== null && p[1] !== '');
    const half = Math.floor((W - 2) / 2);
    if (two && W >= 76) {
      for (let i = 0; i < list.length; i += 2) {
        const a = list[i];
        const b = list[i + 1];
        const cell = (p) => (p ? pad(`${pad(ascii(p[0]), 13)}: ${ascii(p[1])}`, half) : '');
        push(`${cell(a)}  ${cell(b)}`.trimEnd());
      }
    } else {
      for (const [k, v] of list) {
        const body = wrap(v, W - 20);
        push(`${pad(ascii(k), 18)}: ${body[0]}`);
        body.slice(1).forEach((l) => push(' '.repeat(20) + l));
      }
    }
  };
  if ((m.party || []).length) {
    kv(m.party, true);
    rule();
  }

  const cols = (m.columns || []).map((c, i) => ({ ...c, i })).filter((c) => !c.rawSkip);
  if (cols.length) {
    const numW = W >= 76 ? 14 : 12;
    const fixed = cols.slice(1).reduce((a, c) => a + (c.kind === 'qty' ? 7 : c.kind === 'num' ? numW : 12), 0);
    const firstW = Math.max(12, W - fixed);
    const widths = cols.map((c, j) => (j === 0 ? firstW : c.kind === 'qty' ? 7 : c.kind === 'num' ? numW : 12));
    const cell = (v, j) => (cols[j].align === 'right' ? padL(ascii(v), widths[j]) : pad(` ${ascii(v)}`.slice(j === 0 ? 1 : 0), widths[j]));
    push(cols.map((c, j) => cell(c.label, j)).join(''), { bold: true });
    for (const r of m.rows || []) {
      const first = wrap(r[cols[0].i], firstW - 1);
      push(pad(first[0], firstW) + cols.slice(1).map((c, j) => cell(r[c.i], j + 1)).join(''));
      first.slice(1).forEach((l) => push(`  ${l}`));
    }
    rule();
  }
  for (const t of m.totals || []) {
    const v = ascii(t.value);
    const line = padL(`${ascii(t.label)}  ${padL(v, 16)}`, W);
    push(line, { bold: t.strong });
  }
  if ((m.totals || []).length) rule();
  if (m.words) wrap(`Amount in words: ${m.words}`, W).forEach((l) => push(l));
  if ((m.details || []).length) kv(m.details, true);
  if (m.notes) wrap(`Note: ${m.notes}`, W).forEach((l) => push(l));
  push('');
  push('');
  const sigs = m.signatures || ['Authorised signature'];
  const sw = Math.floor(W / sigs.length);
  push(sigs.map((_, i) => (i === sigs.length - 1 ? padL('.'.repeat(Math.min(22, sw - 2)), sw) : pad('.'.repeat(Math.min(22, sw - 2)), sw))).join(''));
  push(sigs.map((x, i) => (i === sigs.length - 1 ? padL(ascii(x), sw) : pad(ascii(x), sw))).join(''));
  if (m.footer) wrap(m.footer, W).forEach((l) => push(l));
  return out;
}

const ESC = 0x1b;

/** Raw ESC/P bytes for the LQ-310: page length = form length, so each slip starts on a new form. */
export function slipEscp(models, settings, { quality = 'lq' } = {}) {
  const s = normalizeSlipSettings(settings);
  const list = (Array.isArray(models) ? models : [models]).filter(Boolean);
  const labels = s.copies === 2 ? ['Office copy', 'Customer copy'] : [null];
  const formLines = Math.max(12, Math.min(127, Math.round((s.heightMm / 25.4) * 6)));
  const leftCols = Math.max(0, Math.round(((s.marginMm + s.offsetXmm) / 25.4) * s.cpi));
  const topSteps = Math.max(0, Math.min(255, Math.round(((s.marginMm + s.offsetYmm) / 25.4) * 180)));
  const bytes = [
    ESC, 0x40, // reset
    ESC, 0x78, quality === 'draft' ? 0 : 1, // letter quality
    ...(s.cpi === 12 ? [ESC, 0x4d] : [ESC, 0x50]), // 12 / 10 cpi
    ESC, 0x32, // 1/6 inch line spacing
    ESC, 0x43, formLines, // form length in lines
    ESC, 0x6c, leftCols, // left margin
    ...(s.boxChars ? [ESC, 0x74, 0x01] : []), // PC437 graphics table (line drawing)
  ];
  const enc = (text) => {
    for (const ch of text) {
      if (ch === H1) bytes.push(s.boxChars ? 0xc4 : 0x2d);
      else if (ch === H2) bytes.push(s.boxChars ? 0xcd : 0x3d);
      else {
        const c = ch.charCodeAt(0);
        bytes.push(c >= 0x20 && c <= 0x7e ? c : 0x20);
      }
    }
  };
  let first = true;
  for (const m of list) {
    for (const label of labels) {
      if (!first) bytes.push(0x0c); // next form
      first = false;
      if (topSteps) bytes.push(ESC, 0x4a, topSteps); // advance n/180 inch
      for (const line of slipLines({ ...m, copyLabel: label || m.copyLabel }, s)) {
        if (line.bold) bytes.push(ESC, 0x45);
        if (line.wide) bytes.push(ESC, 0x57, 1);
        enc(line.text);
        if (line.wide) bytes.push(ESC, 0x57, 0);
        if (line.bold) bytes.push(ESC, 0x46);
        bytes.push(0x0d, 0x0a);
      }
    }
  }
  bytes.push(0x0c);
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------
function openWindow(html) {
  const win = window.open('', '_blank', 'width=980,height=820');
  if (!win) {
    toast.error(tx('تم حظر النافذة المنبثقة: اسمح بالنوافذ المنبثقة للطباعة.', 'Pop-up blocked: allow pop-ups to print.'));
    return null;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* the Print button stays on the page */
    }
  }, 450);
  return win;
}

function download(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Print one or more slips with this counter's printer settings.
 * @param {object|object[]} models slip model(s)
 * @param {object} [override] settings override, e.g. { mode: 'raw' }
 */
export function printSlip(models, override = {}) {
  const s = normalizeSlipSettings({ ...getSlipSettings(), ...override });
  const list = (Array.isArray(models) ? models : [models]).filter(Boolean);
  if (!list.length) return;
  if (s.mode === 'raw') {
    const name = ascii(list[0].number || list[0].title || 'slip').replace(/[^A-Za-z0-9_-]/g, '_');
    download(slipEscp(list, s), `${name}${list.length > 1 ? `_x${list.length}` : ''}.prn`);
    toast.info(tx('أرسل الملف إلى الطابعة كما هو (raw).', 'Send the .prn file to the printer raw: copy /b file.prn \\\\localhost\\LQ310'));
    return;
  }
  openWindow(slipDocument(list, s));
}

export function printAlignmentTest(settings) {
  openWindow(alignmentDocument(settings || getSlipSettings()));
}
