/**
 * Ticket 0905 — the clearance.
 *
 * A leaf, so `military.ts` can ask for an investigation at the end of a recruit's training year without a cycle. A
 * clearance is granted by an investigation, whose result is a hash of the seed, the generation, the age and the level (no
 * random stream is touched, so a life that never meets one replays as it did); it is held while the work that needs it
 * lasts and for two years after; and it is lost to a denial, a revocation or the passing of the grace.
 */

import {
  CLEARANCE_GRACE_YEARS,
  CLEARANCE_LABELS,
  INVESTIGATION_DAYS,
  INVESTIGATION_DENIED_LINES,
  INVESTIGATION_GRANTED_LINES,
  clearanceCovers,
  clearanceRank,
  denialChance,
} from '@yearafter/content';
import { mixedUnit, stablePick } from '@yearafter/core';
import type { ClearanceLevel, Clearance, IntelState } from './intel-state';
import type { MilitaryState } from './military-state';

const unit = (seed: number | string, gen: number, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`intel:${seed}:${gen}:${parts.join(':')}`);

/** The clearance somebody holds that is still good at this age, or nothing. */
export function clearanceHeld(intel: IntelState, age: number): Clearance | undefined {
  const clearance = intel.clearance;
  if (!clearance) return undefined;
  if (clearance.idleSince !== undefined && age - clearance.idleSince >= CLEARANCE_GRACE_YEARS) {
    return undefined;
  }
  return clearance;
}

/** Whether a clearance held and good covers a job that needs `level`. */
export const clearanceMeets = (intel: IntelState, age: number, level: ClearanceLevel): boolean => {
  const held = clearanceHeld(intel, age);
  return held !== undefined && clearanceCovers(held.level, level);
};

/** The most serious discharge of any service so far: dishonorable, then general. Nothing for a clean record. */
export function worstDischarge(military: MilitaryState): string | undefined {
  let worst: string | undefined;
  for (const row of military.past) {
    if (row.discharge === 'dishonorable') return 'dishonorable';
    if (row.discharge === 'general') worst = 'general';
  }
  return worst;
}

export interface Investigation {
  readonly level: ClearanceLevel;
  readonly granted: boolean;
  readonly days: number;
  /** A line for the timeline. */
  readonly line: string;
}

const fillWords = (line: string, level: ClearanceLevel, days: number): string =>
  line.replaceAll('%days%', String(days)).replaceAll('%level%', CLEARANCE_LABELS[level]);

export interface InvestigationInput {
  readonly seed: number | string;
  readonly generation: number;
  readonly age: number;
  readonly level: ClearanceLevel;
  readonly discipline: number;
  readonly military: MilitaryState;
  readonly intel: IntelState;
  /** Names the draw, so two investigations in a year (never done) wouldn't share one. */
  readonly key?: string;
}

/** Run an investigation. The result is the same however many times it is asked for. */
export function investigate(input: InvestigationInput): Investigation {
  const worst = worstDischarge(input.military);
  const chance = denialChance({
    level: input.level,
    discipline: input.discipline,
    ...(worst !== undefined ? { worstDischarge: worst } : {}),
    revokedBefore: input.intel.revokedAge !== undefined,
  });
  const draw = unit(
    input.seed,
    input.generation,
    'clearance',
    input.age,
    input.level,
    input.key ?? 'investigation',
  );
  const granted = draw >= chance;
  const days = INVESTIGATION_DAYS[input.level];
  const pool = granted ? INVESTIGATION_GRANTED_LINES : INVESTIGATION_DENIED_LINES;
  const line = fillWords(
    stablePick(pool, `${input.age}:${input.level}:${granted ? 'granted' : 'denied'}`) ?? '',
    input.level,
    days,
  );
  return { level: input.level, granted, days, line };
}

/** A clearance granted at an age. Somebody already cleared higher keeps the higher one. */
export function withClearance(intel: IntelState, level: ClearanceLevel, age: number): IntelState {
  const held = intel.clearance;
  const keep =
    held !== undefined &&
    held.idleSince === undefined &&
    clearanceRank(held.level) >= clearanceRank(level);
  if (keep) return intel;
  return { ...intel, clearance: { level, grantedAge: age } };
}

/** A clearance taken away. It is gone, and every investigation after it weighs it. */
export function withoutClearance(intel: IntelState, age: number): IntelState {
  const { clearance: _gone, ...rest } = intel;
  return { ...rest, revokedAge: age };
}
