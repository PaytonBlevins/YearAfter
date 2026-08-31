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
import { runSchoolYear, statusLabel, type EducationState } from '@yearafter/education';
import type { TimelineKind } from '@yearafter/character';
import type { GameState } from '../game-state';

export interface EducationPhaseOutput {
  readonly player: Character;
  readonly education: EducationState;
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
  });

  const player: Character = {
    ...state.player,
    stats: nudgeStats(state.player.stats, result.statDeltas),
    // Ticket 0205 turns hidden load into visible stress. 0204 only reports it.
    stress: { ...state.player.stress, hiddenLoad: result.hiddenLoad },
    occupation: occupationFor(result.state, age),
  };

  return {
    player,
    education: result.state,
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
export function occupationFor(education: EducationState, age: number): string {
  return statusLabel(education, age);
}
