/**
 * Ticket 0106 — Seven stat bars.
 *
 * Spec 828–838: the permanent visible stats attach visually to the Advance area,
 * and there are exactly seven — Happiness, Health, Smarts, Looks, Charisma,
 * Willpower, Discipline.
 *
 * Three layouts were prototyped for the v0.01 review gate (compact, grid,
 * inline). The product owner chose **grid**, and the other two are deleted
 * rather than left behind as dead options.
 *
 * What grid buys: two columns of four rows costs roughly half the vertical space
 * of seven full-width rows, which is four extra timeline entries visible on the
 * Life screen, and it has room for the numeric value beside each label.
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  STAT_LABELS,
  VISIBLE_STAT_KEYS,
  type VisibleStatKey,
  type VisibleStats,
} from '@yearafter/character';
import { colors, layout, spacing, typography } from '../theme/theme';

const STAT_COLORS: Record<VisibleStatKey, string> = {
  happiness: colors.statHappiness,
  health: colors.statHealth,
  smarts: colors.statSmarts,
  looks: colors.statLooks,
  charisma: colors.statCharisma,
  willpower: colors.statWillpower,
  discipline: colors.statDiscipline,
};

export interface StatBarsProps {
  readonly stats: VisibleStats;
}

export function StatBars({ stats }: StatBarsProps) {
  return (
    <View style={styles.grid}>
      {VISIBLE_STAT_KEYS.map((key) => (
        <View key={key} style={styles.cell}>
          <View style={styles.cellHead}>
            <Text style={styles.label}>{STAT_LABELS[key]}</Text>
            <Text style={styles.value}>{stats[key]}</Text>
          </View>
          <Track value={stats[key]} color={STAT_COLORS[key]} />
        </View>
      ))}
    </View>
  );
}

function Track({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    columnGap: spacing.lg,
    rowGap: spacing.sm,
  },
  cell: { width: '46%' },
  cellHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  value: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  // Width is explicit rather than `flex: 1`. The track sits inside a column,
  // where flex would size it vertically and leave it zero-width.
  track: {
    width: '100%',
    height: layout.statBarHeight,
    borderRadius: layout.statBarHeight / 2,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: layout.statBarHeight / 2 },
});
