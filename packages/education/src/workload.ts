/**
 * Ticket 0204 — the hidden workload model.
 *
 * This is the piece that replaces an artificial limit with a real one.
 *
 * The shipped 0203 build asked "which one club do you want, forever?" and
 * allowed exactly one pick. The product owner rejected that: a character should
 * be able to sign up for five things. They just cannot *survive* five things,
 * and finding that out is the game.
 *
 * So nothing stops a player joining everything. What happens instead is that
 * committed hours accumulate against a capacity that varies by character, and
 * past that capacity the year starts costing grades, health and happiness on its
 * own. The player is never shown a budget — spec 1824 forbids a workload-budget
 * UI and spec 661 forbids a visible time budget. They are shown the
 * consequences, in the feed, in plain sentences.
 *
 * Spec 1823 makes the same rule for adults: "Full-time work during college is
 * allowed; stress/performance handles overcommitment." Same model, later.
 */

import type { Personality, VisibleStats } from '@yearafter/character';

/**
 * Weekly hours a character can carry before anything suffers.
 *
 * A hard-working, self-disciplined teenager genuinely can hold down more than a
 * scattered one, and this is where two hidden traits that already exist earn
 * their keep rather than sitting unused (personality.ts requires every trait to
 * have a named consumer).
 */
export const BASE_CAPACITY_HOURS = 14;

export function capacityFor(stats: VisibleStats, personality: Personality, age: number): number {
  const discipline = (stats.discipline - 50) / 50; // -1 .. 1
  const willpower = (stats.willpower - 50) / 50;
  const ambition = (personality.ambition - 50) / 50;
  // Older teenagers can carry more than nine-year-olds, and it is not close.
  const maturity = Math.max(0, Math.min(1, (age - 8) / 8)) * 6;
  return BASE_CAPACITY_HOURS + maturity + discipline * 5 + willpower * 4 + ambition * 2;
}

export interface WorkloadAssessment {
  /** Everything committed this year, in hours per week. */
  readonly hours: number;
  readonly capacity: number;
  /** Hours over capacity. Zero when comfortable. */
  readonly overload: number;
  /**
   * 0 when comfortable, rising with overload. Written into
   * `character.stress.hiddenLoad`, which Ticket 0205 turns into visible stress.
   * 0204 deliberately does not touch `stress.level` — that is 0205's contract.
   */
  readonly load: number;
}

export function assessWorkload(
  hours: number,
  stats: VisibleStats,
  personality: Personality,
  age: number,
): WorkloadAssessment {
  const capacity = capacityFor(stats, personality, age);
  const overload = Math.max(0, hours - capacity);
  return { hours, capacity, overload, load: Math.round(overload * 4) };
}

/** Overload past this many hours a week starts producing consequence events. */
export const OVERLOAD_EVENT_THRESHOLD = 4;

/**
 * What being overcommitted costs, per year.
 *
 * Grades take the hardest hit, then happiness, then health — which is the order
 * it actually happens in for a teenager with too much on. It means an
 * overloaded character reads as a person having a hard year rather than as a
 * number going down.
 *
 * The health figure was halved for Ticket 0205. Stress now bills the same busy
 * schedule for happiness and grades, and a screenshot of a fourteen-year-old
 * with Health at 29 showed what two systems charging one account looks like.
 * What is left here is the physical part — tiredness, not enough sleep, meals
 * eaten standing up — which is 0204's to charge and nobody else's.
 */
export function overloadPenalties(overload: number): {
  performance: number;
  health: number;
  happiness: number;
} {
  if (overload <= 0) return { performance: 0, health: 0, happiness: 0 };
  const severity = Math.min(3, overload / 6);
  return {
    performance: -Math.round(severity * 7),
    health: -Math.round(severity * 2),
    happiness: -Math.round(severity * 5),
  };
}

/**
 * A character with time on their hands.
 *
 * The reward for an empty schedule is not nothing — it is rest — but it is
 * deliberately smaller than what a committed year gives, or the optimal play
 * would be to join nothing.
 */
export const IDLE_THRESHOLD_HOURS = 4;
