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
  /** The age the character is becoming this year. See the note in `runStress`. */
  readonly age: number;
  /** Whether the character is at school this year, for the standing input. */
  readonly atSchool: boolean;
  /**
   * Ticket 0210. How demanding this year's job is, 0–100, or 0 for nobody
   * working. Spec 661 forbids a visible time budget, so this arrives here as a
   * number the player never sees and leaves as a sentence about their year.
   */
  readonly workDemand?: number;
  /** Ticket 0702. Discretionary hours a week the character's channels take. */
  readonly creatorHours?: number;
}

/**
 * A job's demand as discretionary hours a week.
 *
 * NOT the hours the job takes — a forty-hour job is not forty hours of the
 * capacity this model measures, because capacity here is what is left after the
 * things a life already requires (0205 measured it at 17–21 hours a week). What
 * a job spends is the SLACK it takes: an easy one leaves most of the evening,
 * a hard one leaves none of it.
 *
 * MEASURED, and the first value was wrong by a hair, which is the worst way to
 * be wrong. At 0.16 the hardest job in the catalog came to twelve hours against
 * a capacity of nineteen — under `WORKLOAD_SHOULDER` of 0.7, which is 13.3 — so
 * NOTHING a job did ever reached the stress model and a character working
 * nights in a kitchen had the same stress at fifty as one who had never worked.
 * The wiring existed and carried nothing. CORE_RULES 13.7 again, and the reason
 * the number below is chosen against the shoulder rather than against a guess.
 *
 * At 0.28 an easy job (demand 36) costs ten hours and stays under the shoulder,
 * a middling one (50) just reaches it, and the hardest (76) costs twenty-one
 * and hurts. So a demanding job plus two children is a bad year and an easy job
 * plus two children is a busy one, which is the distinction the model is for.
 */
export const HOURS_PER_DEMAND = 0.28;

export interface StressPhaseOutput {
  readonly player: Character;
  /** School performance after stress took its cut. Folded back by advanceYear. */
  readonly performance: number;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

export function runStress(input: StressPhaseInput): StressPhaseOutput {
  const previous = input.player.stress.level;

  const sources = stressSources({
    hours: input.hours + (input.workDemand ?? 0) * HOURS_PER_DEMAND + (input.creatorHours ?? 0),
    capacity: input.capacity,
    household: input.family,
    ...(input.atSchool ? { behaviour: input.education.behaviour } : {}),
    eventStress: input.eventStress,
    /*
      Ticket 0212. Grief needs to know how long ago and how old they were — and
      it must be the age the character is BECOMING, not the one they were.
      `input.player.age` is still last year's here: `advanceYear` stamps the new
      age at commit time, after every phase has run. Using it would have made
      `age - diedWhenPlayerWas` come out at MINUS ONE in the year a parent died,
      so grief would have weighed zero in the only year it certainly matters.
    */
    age: input.age,
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
