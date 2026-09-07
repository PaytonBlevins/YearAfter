/**
 * Ticket 0205 — the stress phase.
 *
 * Third phase module, same shape as the other two: build the inputs the domain
 * package wants, run it, fold the result back. All the model is in
 * @yearafter/stress, which knows nothing about GameState.
 *
 * Ordering inside the year is deliberate and fixed. Stress runs LAST, after
 * education and after events, because it is the only phase whose job is to
 * summarise the year rather than to make things happen in it. It needs the
 * hidden workload load education computed, the household warmth events have
 * finished moving, and the stress those events contributed.
 *
 * Its consequences therefore land the year AFTER the pressure — which is both
 * how it works and what keeps the feed readable. A year that says "there was
 * more on than there were hours" and then costs happiness in the same breath
 * reads as a punishment; a year that says it, and a following year that is
 * visibly worse for it, reads as a consequence.
 */

import { nudgeStats, type Character, type TimelineKind } from '@yearafter/character';
import { clampStat } from '@yearafter/core';
import type { EducationState } from '@yearafter/education';
import {
  advanceStress,
  isStressRelevant,
  stressConsequences,
  stressLine,
  stressSources,
} from '@yearafter/stress';
import type { Household } from '@yearafter/relationships';

export interface StressPhaseInput {
  readonly player: Character;
  readonly family: Household;
  readonly education: EducationState;
  /** Committed hours a week and capacity, from the education phase. */
  readonly hours: number;
  readonly capacity: number;
  /** Stress points this year's events contributed, from the events phase. */
  readonly eventStress: number;
  /** Whether the character is at school this year, for the standing input. */
  readonly atSchool: boolean;
}

export interface StressPhaseOutput {
  readonly player: Character;
  /** School performance after stress took its cut. Folded back by advanceYear. */
  readonly performance: number;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

export function runStress(input: StressPhaseInput): StressPhaseOutput {
  const previous = input.player.stress.level;

  const sources = stressSources({
    hours: input.hours,
    capacity: input.capacity,
    household: input.family,
    ...(input.atSchool ? { behaviour: input.education.behaviour } : {}),
    eventStress: input.eventStress,
  });

  const level = advanceStress(previous, sources, input.player.stats, input.player.personality);

  // Consequences are charged on where the character has ENDED up, so a year
  // that finished calm costs nothing even if it started badly.
  const cost = stressConsequences(level);
  const player: Character = {
    ...input.player,
    stats: nudgeStats(input.player.stats, { happiness: cost.happiness }),
    stress: { level, hiddenLoad: input.player.stress.hiddenLoad },
  };

  // Age rotates the phrasing, so two hard years running do not use the same
  // sentence. `input.player.age` is the age the character is finishing.
  const line = stressLine(level, previous, sources, input.player.age);
  return {
    player,
    performance: clampStat(input.education.performance + cost.performance),
    lines: line ? [{ kind: 'passive' as TimelineKind, text: line }] : [],
  };
}

export { isStressRelevant };
