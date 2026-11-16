/**
 * Counter printer settings (per computer: each counter has its own printer).
 *
 * Modes
 *   lq310  Epson LQ-310 through its Windows/Linux driver: the browser prints a
 *          formatted slip (ruled boxes, bold headings, Arabic / Tamil names)
 *          sized exactly to the form loaded in the tractor, so every slip
 *          starts at the top of the next form.
 *   raw    Epson LQ-310 raw ESC/P job (.prn): printer fonts, fastest; ASCII only.
 *   laser  Laser / inkjet colour slip (A5, or two copies on A4).
 */

export const SLIP_MODES = [
  { value: 'lq310', en: 'Epson LQ-310 (driver installed) – formatted slip', ar: 'Epson LQ-310 (مع التعريف) – إيصال منسق' },
  { value: 'raw', en: 'Epson LQ-310 raw ESC/P file (.prn)', ar: 'ملف ESC/P خام لطابعة LQ-310' },
  { value: 'laser', en: 'Laser / inkjet (colour)', ar: 'ليزر / حبر (ملون)' },
];

/** Paper presets in millimetres. The LQ-310 takes forms up to 10 in (254 mm) wide. */
export const SLIP_PAPERS = [
  { value: 'cont_95x55', en: 'Continuous form 9.5 × 5.5 in (half sheet)', ar: 'ورق مستمر 9.5 × 5.5 بوصة', w: 241.3, h: 139.7 },
  { value: 'cont_95x11', en: 'Continuous form 9.5 × 11 in (full sheet)', ar: 'ورق مستمر 9.5 × 11 بوصة', w: 241.3, h: 279.4 },
  { value: 'cont_10x6', en: 'Continuous form 10 × 6 in', ar: 'ورق مستمر 10 × 6 بوصة', w: 254, h: 152.4 },
  { value: 'a5l', en: 'A5 landscape cut sheet', ar: 'A5 أفقي', w: 210, h: 148 },
  { value: 'a5p', en: 'A5 portrait cut sheet', ar: 'A5 عمودي', w: 148, h: 210 },
  { value: 'a4', en: 'A4', ar: 'A4', w: 210, h: 297 },
  { value: 'custom', en: 'Custom size', ar: 'مقاس مخصص', w: 241.3, h: 139.7 },
];

export const DEFAULT_SLIP_SETTINGS = {
  mode: 'lq310',
  paper: 'cont_95x55',
  widthMm: 241.3,
  heightMm: 139.7,
  marginMm: 6, // printable margin inside the form
  offsetXmm: 0, // alignment calibration (+ moves right)
  offsetYmm: 0, // alignment calibration (+ moves down)
  copies: 1, // 2 → office copy + customer copy (plain paper); 1 for carbon multi-part forms
  showLogo: false, // logos print slowly (graphics) on impact printers
  fontPt: 10,
  cpi: 10, // raw mode: 10 (pica) or 12 (elite)
  boxChars: true, // raw mode: PC437 line-drawing characters
};

const KEY = 'kh_slip_printer_v2';
const LEGACY_KEY = 'kh_receipt_printer';

const clamp = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeSlipSettings(s = {}) {
  const d = DEFAULT_SLIP_SETTINGS;
  const mode = SLIP_MODES.some((m) => m.value === s.mode) ? s.mode : d.mode;
  const paper = SLIP_PAPERS.some((p) => p.value === s.paper) ? s.paper : d.paper;
  const preset = SLIP_PAPERS.find((p) => p.value === paper);
  const custom = paper === 'custom';
  return {
    mode,
    paper,
    widthMm: custom ? clamp(s.widthMm, 76, 254, d.widthMm) : preset.w,
    heightMm: custom ? clamp(s.heightMm, 76, 356, d.heightMm) : preset.h,
    marginMm: clamp(s.marginMm, 0, 25, d.marginMm),
    offsetXmm: clamp(s.offsetXmm, -20, 20, 0),
    offsetYmm: clamp(s.offsetYmm, -20, 20, 0),
    copies: Number(s.copies) === 2 ? 2 : 1,
    showLogo: Boolean(s.showLogo),
    fontPt: clamp(s.fontPt, 8, 13, d.fontPt),
    cpi: Number(s.cpi) === 12 ? 12 : 10,
    boxChars: s.boxChars !== false,
  };
}

function legacy() {
  try {
    const v = localStorage.getItem(LEGACY_KEY);
    if (v === 'lq310') return { mode: 'lq310', paper: 'a5p' };
    if (v === 'a4x2') return { mode: 'laser', paper: 'a4', copies: 2 };
    if (v === 'a5') return { mode: 'laser', paper: 'a5p' };
  } catch {
    /* storage blocked */
  }
  return null;
}

export function getSlipSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeSlipSettings(JSON.parse(raw));
  } catch {
    /* storage blocked or corrupt → defaults */
  }
  return normalizeSlipSettings(legacy() || {});
}

export function saveSlipSettings(s) {
  const n = normalizeSlipSettings(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(n));
  } catch {
    /* storage blocked — settings last for this page only */
  }
  return n;
}
