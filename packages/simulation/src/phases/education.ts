/**
 * Ticket 0204 — the education phase.
 *
 * The second phase module. Same shape as `phases/events.ts`: build the input the
 * domain package wants, run it, fold the results back into state. All the actual
 * schooling logic is in @yearafter/education, which knows nothing about
 * GameState.
 *
 * Ordering inside the year is deliberate and fixed. Education runs BEFORE
 * events, because the events that fire in a school year should be able to read
 * the grade the character is now in — and because a report-card event that
 * arrives before the report card is nonsense.
 */

import { nudgeStats, type Character } from '@yearafter/character';
import { add, dollars } from '@yearafter/core';
import { isInSchool, runSchoolYear, statusLabel, type EducationState } from '@yearafter/education';
import type { TimelineKind } from '@yearafter/character';
import type { GameState } from '../game-state';
import { RngDomains } from '../rng/rng';

export interface EducationPhaseOutput {
  readonly player: Character;
  readonly education: EducationState;
  /** Committed hours and capacity, for the stress phase (Ticket 0205). */
  readonly hours: number;
  readonly capacity: number;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

/**
 * Run the school year and fold it into the character.
 *
 * What the year costs is REPORTED, not charged: activity fees are borne by the
 * household, not by a fifteen-year-old's pocket money, and whether the family
 * can afford them is already decided by the wealth gate on joining. Charging the
 * player and flooring at zero produced a feed line saying $216 had been paid
 * beside a balance of $0 — a sentence the game could not back up. The real
 * ledger entry arrives with Ticket 0301.
 */
export function runEducation(state: GameState, age: number): EducationPhaseOutput {
  const result = runSchoolYear(state.education, {
    age,
    stats: state.player.stats,
    talents: state.player.talents,
    personality: state.player.personality,
    wealth: state.family.finances.band,
    // Ticket 0210. One draw a year, for the only thing in the school model that
    // is not deterministic: whether a character who has stopped caring actually
    // stops going. The package stays pure — it is handed a number, it does not
    // make one.
    roll: state.rng.stream(RngDomains.Education).next(),
  });

  // Money the character EARNED. Unlike an activity fee — which the household
  // bears and this phase only reports — a paper round pays the child, and it is
  // the first money in this game that is genuinely theirs.
  const wages = result.earned.reduce((total, entry) => total + entry.dollars, 0);

  const player: Character = {
    ...state.player,
    cash: wages > 0 ? add(state.player.cash, dollars(wages)) : state.player.cash,
    stats: nudgeStats(state.player.stats, result.statDeltas),
    // Ticket 0205 turns hidden load into visible stress. 0204 only reports it.
    stress: { ...state.player.stress, hiddenLoad: result.hiddenLoad },
    // School's own answer. `advanceYear` overwrites this once the employment
    // phase has run, because the job the character finishes the year in is the
    // one the header should name.
    occupation: occupationFor(result.state, age),
  };

  return {
    player,
    education: result.state,
    hours: result.hours,
    capacity: result.capacity,
    lines: result.lines.map((line) => ({ kind: line.kind as TimelineKind, text: line.text })),
  };
}

/**
 * The stored copy of the status label, for the save-list summary.
 *
 * The UI does NOT read this — it calls `statusLabel` at render time, because a
 * stored label goes stale the moment a save is migrated or resumed and two
 * screens then disagree about the same child. Kept written here so the save
 * list can show "8th Grader" without loading and migrating the whole document.
 */
export function occupationFor(education: EducationState, age: number, jobTitle?: string): string {
  // Ticket 0210. A job outranks a school record: somebody who left at eighteen
  // and has been a line cook for six years is a line cook, not a "High School
  // Graduate", and calling them the second is the header quietly still
  // describing the last thing that happened before the game had employment.
  if (jobTitle !== undefined && !isInSchool(education)) return jobTitle;
  return statusLabel(education, age);
}
