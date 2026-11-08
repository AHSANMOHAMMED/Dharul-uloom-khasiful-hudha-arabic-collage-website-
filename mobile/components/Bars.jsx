import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

/**
 * Dependency-free bar visualisations built from Views.
 */

const pct = (value, max) => {
  const v = Number(value || 0);
  const m = Number(max || 0);
  if (!(m > 0) || !(v > 0)) return 0;
  return Math.max(2, Math.min(100, (v / m) * 100));
};

/** One horizontal bar: label …… display, then a track. */
export function HBar({ label, value, max, display, sub, color = colors.primary, onPress }) {
  const { row } = useI18n();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.hbar} accessibilityLabel={`${label}: ${display ?? value}`}>
      <View style={[styles.hbarHead, row]}>
        <Txt style={styles.flex} numberOfLines={1}>{label}</Txt>
        <Txt variant="strong" style={styles.num}>{display ?? String(value ?? '—')}</Txt>
      </View>
      <View style={[styles.track, row]}>
        <View style={[styles.fill, { width: `${pct(value, max)}%`, backgroundColor: color }]} />
      </View>
      {sub ? <Txt variant="small">{sub}</Txt> : null}
    </Wrapper>
  );
}

/** Colour key for a chart. items: [{ label, color }] */
export function Legend({ items }) {
  const { row } = useI18n();
  return (
    <View style={[styles.legend, row]}>
      {items.map((i) => (
        <View key={i.label} style={[styles.legendItem, row]}>
          <View style={[styles.swatch, { backgroundColor: i.color }]} />
          <Txt variant="small">{i.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * Vertical (grouped) columns, e.g. 12 months of invoiced vs collected.
 * data: [{ key, label, title, values: [n, n] }]  seriesColors: [c, c]
 * format(n) renders values in the detail line shown for the tapped column.
 * max: optional fixed scale (e.g. 100 for percentages).
 */
export function ColumnChart({ data, seriesColors = [colors.primary], seriesLabels = [], format = String, max, height = 140 }) {
  const { row } = useI18n();
  const [sel, setSel] = useState(null);
  const top = max ?? Math.max(0, ...data.flatMap((d) => d.values.map((v) => Number(v || 0))));
  const picked = sel != null ? data[sel] : null;

  return (
    <View style={styles.chart}>
      <Txt variant="small">{format(top)}</Txt>
      <View style={[styles.plot, row, { height }]}>
        {data.map((d, i) => (
          <Pressable
            key={d.key || d.label}
            style={[styles.col, sel === i && styles.colSel]}
            onPress={() => setSel(sel === i ? null : i)}
            accessibilityLabel={`${d.title || d.label}: ${d.values.map((v, k) => `${seriesLabels[k] || ''} ${format(v)}`).join(', ')}`}
          >
            <View style={[styles.colBars, row]}>
              {d.values.map((v, k) => (
                <View
                  key={k}
                  style={[styles.colBar, { height: `${pct(v, top)}%`, backgroundColor: seriesColors[k % seriesColors.length] }]}
                />
              ))}
            </View>
          </Pressable>
        ))}
      </View>
      <View style={[styles.axis, row]}>
        {data.map((d) => (
          <Txt key={d.key || d.label} variant="small" style={styles.axisLabel} numberOfLines={1}>
            {d.label}
          </Txt>
        ))}
      </View>
      {picked ? (
        <Txt variant="small" style={styles.detail}>
          {`${picked.title || picked.label}: ${picked.values
            .map((v, k) => `${seriesLabels[k] ? `${seriesLabels[k]} ` : ''}${format(v)}`)
            .join(' · ')}`}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  hbar: { gap: 4, paddingVertical: 4 },
  hbarHead: { alignItems: 'center', gap: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  legend: { flexWrap: 'wrap', gap: 12 },
  legendItem: { alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  chart: { gap: 4 },
  plot: {
    alignItems: 'flex-end',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.primaryLight,
  },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', borderRadius: radius.sm },
  colSel: { backgroundColor: colors.goldLight },
  colBars: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  colBar: { flex: 1, maxWidth: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { gap: 3 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 10 },
  detail: { color: colors.primaryDark, fontWeight: '700' },
});
