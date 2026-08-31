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

import { clampStat, type StatValue } from '@yearafter/core';

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
