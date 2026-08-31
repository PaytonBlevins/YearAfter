/**
 * Ticket 0106 — Seven stat bars, three prototype layouts.
 *
 * Spec 828–838: the permanent visible stats attach visually to the Advance area,
 * and there are exactly seven — Happiness, Health, Smarts, Looks, Charisma,
 * Willpower, Discipline.
 *
 * The ticket asks for three layouts so the product owner can pick one. The real
 * tradeoff being decided is how much vertical space the stats take from the
 * timeline feed, and whether numbers are shown at all:
 *
 *   compact  Seven full-width rows. Most legible, most scannable, costs the most
 *            height. No numbers — the bar is the information.
 *   grid     Two columns, four rows. Half the height, shows numeric values, but
 *            asks the eye to scan in two dimensions.
 *   inline   One horizontal strip of seven segments with initials. Nearly free
 *            vertical space, maximum room for the feed, least precise.
 *
 * Switch between them in the developer screen. Once chosen, delete the other two
 * rather than leaving dead layouts behind.
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  STAT_LABELS,
  VISIBLE_STAT_KEYS,
  type VisibleStats,
  type VisibleStatKey,
} from '@yearafter/character';
import { colors, layout, spacing, typography } from '../theme/theme';

export type StatBarLayout = 'compact' | 'grid' | 'inline';

const STAT_COLORS: Record<VisibleStatKey, string> = {
  happiness: colors.statHappiness,
  health: colors.statHealth,
  smarts: colors.statSmarts,
  looks: colors.statLooks,
  charisma: colors.statCharisma,
  willpower: colors.statWillpower,
  discipline: colors.statDiscipline,
};

/** Two letters where one is ambiguous: Happiness/Health, Smarts, Charisma/Discipline. */
const STAT_INITIALS: Record<VisibleStatKey, string> = {
  happiness: 'HA',
  health: 'HE',
  smarts: 'SM',
  looks: 'LK',
  charisma: 'CH',
  willpower: 'WP',
  discipline: 'DI',
};

export interface StatBarsProps {
  readonly stats: VisibleStats;
  readonly layout?: StatBarLayout;
}

export function StatBars({ stats, layout: variant = 'compact' }: StatBarsProps) {
  if (variant === 'grid') return <GridLayout stats={stats} />;
  if (variant === 'inline') return <InlineLayout stats={stats} />;
  return <CompactLayout stats={stats} />;
}

/* -------------------------------------------------------------------------- */

function Track({ value, color, height }: { value: number; color: string; height: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.max(0, Math.min(100, value))}%`,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function CompactLayout({ stats }: { stats: VisibleStats }) {
  return (
    <View style={styles.compact}>
      {VISIBLE_STAT_KEYS.map((key) => (
        <View key={key} style={styles.compactRow}>
          <Text style={styles.compactLabel}>{STAT_LABELS[key]}</Text>
          <View style={styles.compactTrack}>
            <Track value={stats[key]} color={STAT_COLORS[key]} height={layout.statBarHeight} />
          </View>
        </View>
      ))}
    </View>
  );
}

function GridLayout({ stats }: { stats: VisibleStats }) {
  return (
    <View style={styles.grid}>
      {VISIBLE_STAT_KEYS.map((key) => (
        <View key={key} style={styles.gridCell}>
          <View style={styles.gridCellHead}>
            <Text style={styles.gridLabel}>{STAT_LABELS[key]}</Text>
            <Text style={styles.gridValue}>{stats[key]}</Text>
          </View>
          <Track value={stats[key]} color={STAT_COLORS[key]} height={layout.statBarHeight} />
        </View>
      ))}
    </View>
  );
}

function InlineLayout({ stats }: { stats: VisibleStats }) {
  return (
    <View style={styles.inline}>
      {VISIBLE_STAT_KEYS.map((key) => (
        <View key={key} style={styles.inlineCell}>
          <Track value={stats[key]} color={STAT_COLORS[key]} height={5} />
          <Text style={styles.inlineLabel}>{STAT_INITIALS[key]}</Text>
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  // Width is explicit rather than `flex: 1`. The grid and inline layouts stack
  // the track inside a column, where flex would size it vertically and leave it
  // zero-width — an invisible bar.
  track: { width: '100%', backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%' },

  compact: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  compactRow: { flexDirection: 'row', alignItems: 'center', height: 20 },
  compactLabel: {
    width: 78,
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  compactTrack: { flex: 1, flexDirection: 'row' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    columnGap: spacing.lg,
    rowGap: spacing.sm,
  },
  gridCell: { width: '46%' },
  gridCellHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  gridLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  gridValue: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  inline: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  inlineCell: { flex: 1, alignItems: 'stretch' },
  inlineLabel: {
    fontFamily: typography.family,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 3,
  },
});
