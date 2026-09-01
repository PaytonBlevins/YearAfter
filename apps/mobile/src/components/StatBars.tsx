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
import { STRESS_BAND_LABELS, isStressRelevant, stressBand } from '@yearafter/stress';
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
  /** 0-100. Ticket 0205. Shown only when it is doing something (spec 1094). */
  readonly stress?: number;
}

/**
 * Stress joins the grid as an eighth cell, and only sometimes.
 *
 * Spec 1094 lists it among the common visible variables as "Stress when
 * relevant" — not as an eighth permanent bar. A bar that sits near zero for
 * twelve years teaches the player to ignore that corner of the screen, so when
 * it finally matters they do not look. It appears when it has something to say
 * and disappears again when the character comes out the other side.
 *
 * It is deliberately NOT added to VISIBLE_STAT_KEYS: that list is canonical at
 * exactly seven (CORE_RULES 3) and the validator fails the build if it changes.
 * Stress is a contextual variable, and it is rendered as one.
 */
export function StatBars({ stats, stress }: StatBarsProps) {
  const showStress = stress !== undefined && isStressRelevant(stress);
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
      {showStress ? (
        <View style={styles.cell}>
          <View style={styles.cellHead}>
            <Text style={styles.label}>Stress</Text>
            {/*
              A word, never the number. Spec 786-795: explain outcomes through
              context, not formulas. The other seven show a value because the
              player acts on them directly; stress is something happening TO the
              character, and "Running on empty" is what they would actually say.
            */}
            <Text style={[styles.value, styles.stressValue]} numberOfLines={1}>
              {STRESS_BAND_LABELS[stressBand(stress)]}
            </Text>
          </View>
          <Track value={stress} color={colors.negative} />
        </View>
      ) : null}
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
  // A phrase rather than a two-digit number, so it needs the room and should
  // not be typeset as a figure.
  stressValue: { color: colors.negative, flexShrink: 1 },
});
