/**
 * Microsoft Word interop: import .docx → HTML (mammoth) and export
 * HTML → .docx (docx), with the letterhead as a full-page background.
 * Both libraries are loaded only when used.
 */
import { sanitizeHtml } from './erp/documentsApi';

export async function docxToHtml(file) {
  if (!/\.docx$/i.test(file?.name || '')) throw new Error('Choose a Word .docx file');
  const mammoth = await import('mammoth/mammoth.browser');
  const lib = mammoth.default || mammoth;
  const { value } = await lib.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { convertImage: lib.images.imgElement((img) => img.read('base64').then((b64) => ({ src: `data:${img.contentType};base64,${b64}` }))) }
  );
  return sanitizeHtml(value);
}

const MM_TO_TWIP = 56.692;
const A4_PX = { w: 794, h: 1123 }; // at 96 dpi

function dataUrlToBytes(url) {
  const b64 = url.split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load the letterhead image');
  const type = res.headers.get('content-type') || '';
  return { bytes: new Uint8Array(await res.arrayBuffer()), type };
}

function imageType(mimeOrUrl) {
  const s = String(mimeOrUrl).toLowerCase();
  if (s.includes('png')) return 'png';
  if (s.includes('gif')) return 'gif';
  if (s.includes('bmp')) return 'bmp';
  return 'jpg';
}

/**
 * Convert sanitised editor HTML into docx paragraphs/tables.
 * Supports p, h1-h4, b/strong, i/em, u, s, br, ul/ol/li, table, hr, img(data:), text alignment, dir=rtl.
 */
function htmlToBlocks(D, html) {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  const HEADINGS = { H1: D.HeadingLevel.HEADING_1, H2: D.HeadingLevel.HEADING_2, H3: D.HeadingLevel.HEADING_3, H4: D.HeadingLevel.HEADING_4 };
  const ALIGN = { center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED, left: D.AlignmentType.LEFT };

  const runsOf = (node, fmt = {}) => {
    const out = [];
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        if (n.textContent) out.push(new D.TextRun({ text: n.textContent, ...fmt }));
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') return out.push(new D.TextRun({ text: '', break: 1 }));
      if (tag === 'IMG' && /^data:image\//.test(n.getAttribute('src') || '')) {
        const w = Math.min(Number(n.getAttribute('width')) || n.naturalWidth || 300, 600);
        const h = Number(n.getAttribute('height')) || Math.round(w * 0.6);
        return out.push(new D.ImageRun({ data: dataUrlToBytes(n.getAttribute('src')), type: imageType(n.getAttribute('src')), transformation: { width: w, height: h } }));
      }
      const next = { ...fmt };
      if (tag === 'B' || tag === 'STRONG') next.bold = true;
      if (tag === 'I' || tag === 'EM') next.italics = true;
      if (tag === 'U') next.underline = {};
      if (tag === 'S') next.strike = true;
      if (tag === 'SUB') next.subScript = true;
      if (tag === 'SUP') next.superScript = true;
      out.push(...runsOf(n, next));
    });
    return out;
  };

  const paraOpts = (el, extra = {}) => {
    const align = (el.style?.textAlign || el.getAttribute?.('align') || '').toLowerCase();
    const rtl = (el.getAttribute?.('dir') || el.closest?.('[dir]')?.getAttribute('dir')) === 'rtl';
    return { alignment: ALIGN[align], bidirectional: rtl || undefined, ...extra };
  };

  const blocks = [];
  const walk = (el, listLevel = -1, ordered = false) => {
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        if (n.textContent.trim()) blocks.push(new D.Paragraph({ children: [new D.TextRun(n.textContent)] }));
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (HEADINGS[tag]) return blocks.push(new D.Paragraph(paraOpts(n, { heading: HEADINGS[tag], children: runsOf(n) })));
      if (tag === 'HR') return blocks.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: '0B3B2E', space: 1 } } }));
      if (tag === 'UL' || tag === 'OL') return walk(n, listLevel + 1, tag === 'OL');
      if (tag === 'LI') {
        blocks.push(
          new D.Paragraph(
            paraOpts(n, ordered ? { numbering: { reference: 'num', level: Math.max(0, listLevel) }, children: runsOf(n) } : { bullet: { level: Math.max(0, listLevel) }, children: runsOf(n) })
          )
        );
        return;
      }
      if (tag === 'TABLE') {
        const rows = [...n.querySelectorAll('tr')].map(
          (tr) =>
            new D.TableRow({
              children: [...tr.children].map(
                (td) =>
                  new D.TableCell({
                    columnSpan: Number(td.getAttribute('colspan')) || undefined,
                    children: [new D.Paragraph({ children: runsOf(td, td.tagName === 'TH' ? { bold: true } : {}) })],
                  })
              ),
            })
        );
        if (rows.length) blocks.push(new D.Table({ rows, width: { size: 100, type: D.WidthType.PERCENTAGE } }));
        return;
      }
      if (tag === 'DIV' || tag === 'BLOCKQUOTE') {
        // Divs that only wrap inline content become one paragraph.
        if ([...n.children].some((c) => /^(P|DIV|H\d|UL|OL|TABLE|HR|BLOCKQUOTE)$/.test(c.tagName))) return walk(n, listLevel, ordered);
      }
      blocks.push(new D.Paragraph(paraOpts(n, { children: runsOf(n) })));
    });
  };
  walk(root);
  return blocks.length ? blocks : [new D.Paragraph('')];
}

/**
 * Build a .docx Blob. letterhead: { url (signed), orientation, margin_*_mm } | null
 */
export async function htmlToDocxBlob({ title, html, letterhead }) {
  const D = await import('docx');
  const landscape = letterhead?.orientation === 'landscape';
  const margins = {
    top: Math.round((letterhead?.margin_top_mm ?? 25) * MM_TO_TWIP),
    bottom: Math.round((letterhead?.margin_bottom_mm ?? 25) * MM_TO_TWIP),
    left: Math.round((letterhead?.margin_left_mm ?? 20) * MM_TO_TWIP),
    right: Math.round((letterhead?.margin_right_mm ?? 20) * MM_TO_TWIP),
    header: 0,
    footer: 0,
  };

  let headers;
  if (letterhead?.url) {
    const { bytes, type } = await fetchBytes(letterhead.url);
    if (/svg/i.test(type)) {
      // Word needs a raster fallback for SVG; skip the background rather than fail.
      headers = undefined;
    } else {
      const size = landscape ? { width: A4_PX.h, height: A4_PX.w } : { width: A4_PX.w, height: A4_PX.h };
      headers = {
        default: new D.Header({
          children: [
            new D.Paragraph({
              children: [
                new D.ImageRun({
                  data: bytes,
                  type: imageType(type),
                  transformation: size,
                  floating: {
                    horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                    verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
                    behindDocument: true,
                    allowOverlap: true,
                  },
                }),
              ],
            }),
          ],
        }),
      };
    }
  }

  const doc = new D.Document({
    title,
    creator: 'Kashiful Hudha ERP',
    numbering: {
      config: [
        {
          reference: 'num',
          levels: [0, 1, 2].map((level) => ({ level, format: D.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: D.AlignmentType.START })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: landscape ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT, width: 11906, height: 16838 },
            margin: margins,
          },
        },
        headers,
        children: htmlToBlocks(D, html),
      },
    ],
  });
  return D.Packer.toBlob(doc);
}

export function safeFilename(title, ext) {
  const base = String(title || 'document').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'document';
  return `${base}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Share a file with the device's share sheet (WhatsApp, email, Drive…), else download it. */
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
