/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { Badge, Button, Card, useLang } from '../ui';
import { formatMoney } from '../../../lib/erp/rpc';
import { STATUS_TONES } from '../../../lib/erp/opsApi';

/**
 * Shared operations and analytics primitives for the light workspace theme.
 */
export const SERIES = ['#2563EB', '#11694A', '#C29A3A'];
export const GRID = '#E2E8F0';
export const AXIS = '#64748B';
export const CURSOR = { fill: 'rgba(15,23,42,0.04)' };
export const axisProps = { stroke: AXIS, tick: { fontSize: 11 }, tickLine: false, axisLine: false };
export const compact = (v) => {
  const x = Number(v) || 0;
  if (Math.abs(x) >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (Math.abs(x) >= 1e3) return `${Math.round(x / 1e3)}k`;
  return String(Math.round(x));
};

/** Badge for a { key: [en, ar] } status map with shared tones. */
export function PairBadge({ map, value }) {
  const { t } = useLang();
  const p = map[value];
  return <Badge tone={STATUS_TONES[value] || 'gray'}>{p ? t(p[0], p[1]) : String(value ?? '—').replace(/_/g, ' ')}</Badge>;
}

/** Tooltip: one row per series, value first (bold), series name secondary. */
export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-lg space-y-1 min-w-36">
      <div className="text-slate-500">{labelFormat(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: p.color || p.fill || p.stroke }} />
          <span className="font-bold tabular-nums">{format(p.value)}</span>
          <span className="text-slate-500">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export const moneyTooltip = (props) => <ChartTooltip {...props} format={formatMoney} />;

/** HTML legend (identity never relies on colour alone: names are always written). */
export function Legend({ items, line = false }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <span className={line ? 'inline-block w-4 h-0.5 rounded' : 'inline-block w-3 h-3 rounded-sm'} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Card holding a chart, with a table-view toggle so every value is reachable without hovering. */
export function ChartCard({ title, subtitle, legend, table, height = 260, children, actions }) {
  const { t } = useLang();
  const [showTable, setShowTable] = useState(false);
  return (
    <Card
      title={title}
      actions={
        <>
          {actions}
          {table && (
            <Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? t('Show chart', 'عرض الرسم') : t('Show table', 'عرض الجدول')}
            </Button>
          )}
        </>
      }
    >
      {subtitle && <p className="text-xs text-gray-400 -mt-2 mb-3">{subtitle}</p>}
      {showTable && table ? (
        table
      ) : (
        <>
          {legend}
          <div style={{ height }}>{children}</div>
        </>
      )}
    </Card>
  );
}

/** Small key/value row used for totals. */
export function TotalLine({ label, value, strong = false, tone = 'text-gray-200' }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 text-sm ${strong ? 'border-t border-slate-200 mt-1 pt-2 font-bold' : ''}`}>
      <span className="text-gray-400">{label}</span>
      <span className={`tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

/** A proportion bar (0–100) for rates in tables. */
export function RateBar({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span className="inline-flex items-center gap-2 w-full min-w-28">
      <span className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${v}%`, background: SERIES[0] }} />
      </span>
      <span className="tabular-nums text-xs text-gray-200 w-12 text-end">{v.toFixed(1)}%</span>
    </span>
  );
}
