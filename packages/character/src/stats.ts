/**
 * Visible character attributes.
 *
 * PROTECTED CONTRACT (spec 1060–1066): character state.
 *
 * Spec 828–838 and 1067–1077 fix the permanently visible set at exactly seven.
 * Spec 31 ("avoid stat creep") means nothing gets added here without an explicit
 * canonical spec revision. Stress is tracked separately because it is shown only
 * when relevant, and mental health is deliberately folded into Happiness and
 * health events rather than becoming an eighth bar (spec 535).
 */

import { clampStat, STAT_MAX, type StatValue } from '@yearafter/core';

export const VISIBLE_STAT_KEYS = [
  'happiness',
  'health',
  'smarts',
  'looks',
  'charisma',
  'willpower',
  'discipline',
] as const;

export type VisibleStatKey = (typeof VISIBLE_STAT_KEYS)[number];

export type VisibleStats = { readonly [K in VisibleStatKey]: StatValue };

export const STAT_LABELS: Readonly<Record<VisibleStatKey, string>> = {
  happiness: 'Happiness',
  health: 'Health',
  smarts: 'Smarts',
  looks: 'Looks',
  charisma: 'Charisma',
  willpower: 'Willpower',
  discipline: 'Discipline',
};

/** Every visible stat lives on the same 0–100 scale. */
export function createStats(values: Partial<Record<VisibleStatKey, number>> = {}): VisibleStats {
  const result = {} as { [K in VisibleStatKey]: StatValue };
  for (const key of VISIBLE_STAT_KEYS) {
    result[key] = clampStat(values[key] ?? 50);
  }
  return result;
}

/** Apply signed deltas, clamped. Returns a new object; stats are never mutated. */
export function adjustStats(
  stats: VisibleStats,
  deltas: Partial<Record<VisibleStatKey, number>>,
): VisibleStats {
  const result = {} as { [K in VisibleStatKey]: StatValue };
  for (const key of VISIBLE_STAT_KEYS) {
    result[key] = clampStat(stats[key] + (deltas[key] ?? 0));
  }
  return result;
}

/**
 * Apply deltas along the growth curve, rather than at face value.
 *
 * Ticket 0203 made this necessary. A childhood is roughly forty events, and if
 * every `+2 happiness` lands as a full `+2` then every character arrives at
 * eighteen above average at everything — measured at +24 happiness, +21
 * charisma and +21 willpower on average, with happiness routinely pinned at 100.
 * A stat everyone maxes is a stat that says nothing.
 *
 * The rule: a gain is at full strength at or below 50 and tapers to nothing at
 * 100; a loss is at full strength at or above 50 and tapers to nothing at 0. So
 * an event that would lift you from 40 to 43 lifts you from 85 to 86, which is
 * both better balance and a truer statement about improvement.
 *
 * This lives here rather than in the event engine deliberately: school (0204),
 * health (0211) and every later system moves stats too, and they should all move
 * them along the same curve. `adjustStats` stays available for the cases that
 * genuinely mean a raw number.
 */
export function nudgeStats(
  stats: VisibleStats,
  deltas: Partial<Record<VisibleStatKey, number>>,
): VisibleStats {
  const result = {} as { [K in VisibleStatKey]: StatValue };
  for (const key of VISIBLE_STAT_KEYS) {
    result[key] = clampStat(stats[key] + curvedDelta(stats[key], deltas[key] ?? 0));
  }
  return result;
}

/** The curve itself, exported so balance tooling and tests can reason about it. */
export function curvedDelta(current: number, delta: number): number {
  if (delta === 0) return 0;
  const headroom = delta > 0 ? (STAT_MAX - current) / 50 : current / 50;
  const scale = headroom > 1 ? 1 : headroom < 0 ? 0 : headroom;
  const scaled = delta * scale;
  // Round to nearest, and let a nudge at the ceiling genuinely do nothing —
  // rounding away from zero would put the inflation straight back. `|| 0`
  // normalises the -0 that rounding a small negative produces.
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return rounded || 0;
}

/**
 * Stress is a contextual variable (spec 1087–1110 "Stress when relevant"), driven
 * by hidden capacity load rather than a visible time budget (spec 661).
 */
export interface StressState {
  /** 0–100. Shown only once it matters. */
  readonly level: StatValue;
  /** Hidden capacity load accumulated from commitments. Never shown. */
  readonly hiddenLoad: number;
}

export const createStressState = (): StressState => ({ level: 0, hiddenLoad: 0 });
