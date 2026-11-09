/**
 * Shared helpers for branded role portals (web).
 */
import { printTable } from './printReport';
import { printDocument } from './erp/financeApi';
import { downloadCsv } from './erp/rpc';

/** Build sidebar nav items: { id, label_en, label_ar, icon, badge? } */
export function nav(items) {
  return items.filter(Boolean);
}

/** Print a tabular dataset via the shared report printer. */
export function printRows(title, columns, rows) {
  const cols = columns.map((c) =>
    typeof c === 'string' ? { key: c, label: c } : { key: c.key || c.label, label: c.label || c.key },
  );
  printTable({
    title,
    columns: cols,
    rows: (rows || []).map((row) => {
      const out = {};
      cols.forEach((c, i) => {
        const src = columns[i];
        if (src && typeof src !== 'string' && src.render) out[c.key] = src.render(row);
        else out[c.key] = row[c.key] ?? '';
      });
      return out;
    }),
    dir: document.documentElement.dir || 'ltr',
  });
}

export function printSimpleDoc(title, htmlBody) {
  printDocument({ title, body: htmlBody });
}

export function exportCsv(filename, rows) {
  downloadCsv(filename, rows || []);
}

/** Default quick links for staff portals */
export const ERP_QUICK_LINK = {
  to: '/erp',
  label_en: 'Full Campus ERP',
  label_ar: 'نظام ERP الكامل',
  icon: 'domain',
};

export const DASHBOARD_QUICK_LINK = {
  to: '/dashboard',
  label_en: 'My Portal',
  label_ar: 'بوابتي',
  icon: 'home',
};
