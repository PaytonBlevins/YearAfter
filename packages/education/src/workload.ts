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

/**
 * The age capacity starts falling, and how fast.
 *
 * Fifty-five is late enough that it does not touch a working life's peak and
 * early enough that a character feels it before the game's median death at
 * seventy-three. The rate is per year of age.
 */
export const WEARS_FROM = 55;
/*
  0.9 HOURS A YEAR, AND THE NUMBER WAS SET AGAINST A THRESHOLD RATHER THAN
  AGAINST A FEELING.

  The first value was 0.42, which looked reasonable and was inert. It produced a
  stress level of 17 for a seventy-year-old still working full time — and
  `RELEVANCE_THRESHOLD` in `@yearafter/stress` is 30, below which stress costs
  exactly nothing by design. The lever was moving a number the game deliberately
  ignores, and the paired comparison against a retiree is the only thing that
  showed it: stress read 17 against 1, and happiness read 81 against 82.

  Measured at 0.9, still working against stopped at sixty:

      age    stress w/r    happiness w/r
       60       11 / 11          81 / 81
       65       32 / 1           80 / 82
       68       50 / 1           74 / 82
       70       70 / 1           62 / 82
       72       84 / 1           42 / 83

  Which is the shape the decision needs. Working into the early sixties costs
  nothing at all; past sixty-seven it gets steadily worse. At 1.2 the same table
  reaches a happiness of 25 by seventy, which does not make retiring a choice —
  it makes carrying on impossible, and that is the same missing decision from
  the other side.
*/
export const WEARS_BY = 0.9;
/** However old somebody gets, they can still carry something. */
export const LEAST_CAPACITY = 6;

export function capacityFor(stats: VisibleStats, personality: Personality, age: number): number {
  const discipline = (stats.discipline - 50) / 50; // -1 .. 1
  const willpower = (stats.willpower - 50) / 50;
  const ambition = (personality.ambition - 50) / 50;
  // Older teenagers can carry more than nine-year-olds, and it is not close.
  const maturity = Math.max(0, Math.min(1, (age - 8) / 8)) * 6;
  /*
    AND IT COMES BACK DOWN. Ticket 0310.

    This function took `age` from the day it was written and only ever used it
    to ramp a child up to sixteen — after which capacity was FLAT FOREVER. A
    seventy-five-year-old could carry exactly what a sixteen-year-old could.

    Measured across 120 played lives, that one clamp is why nobody in this build
    has ever retired: 100% of characters alive at 65, 70 AND 75 were still
    holding a job, with median pay rising the whole way from $60,403 at forty to
    $126,789 at seventy-five. Working into your nineties was free, so stopping
    was strictly worse than not stopping and the decision did not exist.

    The decline starts at `WEARS_FROM` rather than at a retirement age, because
    a body does not wait for a birthday, and it is gradual — this should make a
    long career tiring, not impossible. A character who wants to work to eighty
    still can; they will simply pay for it in stress and in health, which is
    what 0205 and 0211 are for.
  */
  const worn = Math.max(0, age - WEARS_FROM) * WEARS_BY;
  return Math.max(
    LEAST_CAPACITY,
    BASE_CAPACITY_HOURS + maturity - worn + discipline * 5 + willpower * 4 + ambition * 2,
  );
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
