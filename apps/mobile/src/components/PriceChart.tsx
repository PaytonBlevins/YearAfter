/**
 * Ticket 0308c — a price over time.
 *
 * The single most engaging thing on an investment screen, and the one piece
 * 0308 could not have drawn at all: a category with a drift has no past.
 *
 * TWO THINGS THE REFERENCE APP'S CHART DOES NOT DO, and both are cheap once the
 * history exists:
 *
 *   YOUR OWN ENTRY IS MARKED. A price line tells you what the market did; a
 *   line with your average cost on it tells you what YOU did, which is the
 *   question a player actually has. A dashed rule and a small label.
 *
 *   THE LINE IS COLOURED BY WHERE IT ENDED relative to where it started, so a
 *   glance answers "up or down" before any number is read.
 *
 * Deliberately no axes, no gridlines and no tooltips. This is a phone, the
 * series is at most twelve points, and a chart that needs a legend to be read
 * at this size is a chart doing too much. The numbers that matter are on the
 * rows above it.
 */

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { colors, spacing, typography } from '../theme/theme';

export interface PriceChartProps {
  /** Oldest first, in cents. At least two points to draw anything. */
  readonly line: readonly number[];
  /** The player's average cost per unit, in cents. Drawn as a rule if given. */
  readonly entry?: number;
  readonly height?: number;
  /** Shown above the chart, e.g. "10-year performance". */
  readonly caption?: string;
}

const money = (inCents: number): string => {
  const value = inCents / 100;
  if (value >= 1_000) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
};

export function PriceChart({ line, entry, height = 132, caption }: PriceChartProps) {
  /*
    A SINGLE POINT IS NOT A CHART, and saying so beats drawing a flat line that
    looks like a price which never moved. A character in their first year has
    exactly one price for everything.
  */
  if (line.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No history yet — this is its first year.</Text>
      </View>
    );
  }

  const width = 320;
  const pad = 10;
  const lo = Math.min(...line, ...(entry !== undefined ? [entry] : []));
  const hi = Math.max(...line, ...(entry !== undefined ? [entry] : []));
  // A flat series would divide by zero; a whisker of range keeps it centred.
  const span = hi - lo || Math.max(1, hi * 0.1);

  const x = (index: number) => pad + (index / (line.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - lo) / span) * (height - pad * 2);

  const path = line
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`)
    .join(' ');
  const area = `${path} L${x(line.length - 1)},${height - pad} L${x(0)},${height - pad} Z`;

  const first = line[0]!;
  const last = line[line.length - 1]!;
  const up = last >= first;
  const stroke = up ? colors.positive : colors.negative;

  return (
    <View style={styles.wrap}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={area} fill={stroke} fillOpacity={0.12} />
        <Path d={path} stroke={stroke} strokeWidth={2} fill="none" />
        {entry !== undefined && entry >= lo && entry <= hi ? (
          <>
            <Line
              x1={pad}
              y1={y(entry)}
              x2={width - pad}
              y2={y(entry)}
              stroke={colors.inkMuted}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <Circle cx={x(line.length - 1)} cy={y(last)} r={3.5} fill={stroke} />
          </>
        ) : (
          <Circle cx={x(line.length - 1)} cy={y(last)} r={3.5} fill={stroke} />
        )}
      </Svg>
      {/*
        LOW, WHAT YOU PAID, HIGH — and nothing in the middle when there is no
        position. The first version put "12 years" there, directly under a
        caption that already said "12 years": the same sentence twice, a line
        apart, which is CORE_RULES 13.26 at the smallest possible scale. The
        caption owns the span; this row owns the prices.
      */}
      <View style={styles.scale}>
        <Text style={styles.scaleText}>{money(lo)}</Text>
        {entry !== undefined ? <Text style={styles.entryText}>you paid {money(entry)}</Text> : null}
        <Text style={styles.scaleText}>{money(hi)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  caption: {
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  scaleText: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  entryText: { color: colors.inkMuted, fontSize: typography.sizes.caption, fontStyle: 'italic' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.inkMuted, fontSize: typography.sizes.caption },
});
