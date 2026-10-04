/**
 * Ticket 0411 — what a working life does to you.
 *
 * Roadmap finding 2, open since 0211: *"Smarts and Discipline never move after
 * eighteen. An adult character does not develop."* Measured across 80 played
 * lives, and it is worse and more specific than that:
 *
 *  - **Discipline runs 65 at sixteen and 66 at fifty-five.** One point, across
 *    thirty-seven adult years.
 *  - **Looks never moves at all**: 52 at eighteen, 52 at thirty, 52 at
 *    forty-five. A bar the player has been looking at since 0106 is a constant
 *    after birth. (That half is fixed in the health phase, where the age curve
 *    already lives — a career is not what ages a face.)
 *  - And the reason is visible in the catalog. Of the 91 events that can fire at
 *    forty, **one** carries a positive Discipline effect and **none** carries a
 *    negative anything: Smarts +14/−0, Discipline +1/−0, Charisma +26/−0, Looks
 *    +0/−0. A twelve-year-old has 234 events available to them offering 70
 *    Discipline gains and 11 losses. Adulthood is a one-way ratchet with almost
 *    nothing on it.
 *
 * So Charisma drifts 71 → 93 over a life, entirely out of event effects, and the
 * other three sit still. 0409 wrote sixty-seven adult events and gave them
 * happiness, health and money; that was the right call for a content ticket and
 * it is not what a decade of a job does to somebody.
 *
 * WHAT DEVELOPS YOU IS THE WORK, and the build already knows what each kind of
 * work is made of. `TRACK_WANTS` is the table `hireChance` reads to decide what
 * a track is hiring for, every row summing to about 0.44 so no track is easier
 * overall. **What a track wants when it hires is what it builds in you**, and
 * what it does not want, you get out of practice at. One table, two uses, no new
 * content to keep in step.
 *
 * BANDED, NOT A RATE, and this is 0408's lesson taken as read (CORE_RULES
 * 13.66): every delta in this build runs through `curvedDelta`, which is full
 * strength at 50 and tapers to nothing at 100, so a flat push at everybody every
 * working year is an equalising machine — it is precisely how thirteen years of
 * school flattened Smarts into a population with a floor of 56. A fractional
 * rate would be worse than flat: `curvedDelta` rounds to whole points, so
 * anything under half a point quietly floors to zero forever.
 *
 * Pure, like the rest of this package. No randomness, no state.
 */

import { TRACK_WANTS } from './employment';
import type { CareerTrack } from './jobs';

export const GROWTH_STATS = ['smarts', 'discipline', 'charisma'] as const;
export type GrowthStat = (typeof GROWTH_STATS)[number];

/**
 * A weight at or above this means the work genuinely uses the stat.
 *
 * Read off `TRACK_WANTS` rather than chosen: the rows run 0.04 to 0.34, and at
 * 0.14 the split puts two or three stats on the "used" side of a typical track
 * and leaves the ones a job really does not care about below it. Logistics wants
 * discipline (0.34) and nothing else; tech wants smarts (0.34) and nothing else;
 * care wants all three and is the one job that develops the whole person, which
 * is both what the table says and true.
 */
export const USED = 0.14;

/** And at or below this, the work lets it go. */
export const NEGLECTED = 0.08;

/**
 * Performance floors. A year you coasted through teaches you nothing, and a year
 * you were good at teaches you more.
 *
 * These are on the same 0–100 scale `performanceYear` produces, and they are not
 * the firing or promotion thresholds — being developed by a job and being
 * promoted by one are different claims, and tying them together would make this
 * a second promotion lever rather than a model of getting better at something.
 */
export const LEARNS_NOTHING = 34;
export const LEARNS_MORE = 66;

/** Aptitude bands. Above the first, the work compounds on what is already there. */
export const APT_STRONG = 68;
export const APT_ORDINARY = 50;

/**
 * Years in THIS job before it stops teaching, and the point of resetting it.
 *
 * A first year anywhere teaches more than a fifteenth in the same chair, and
 * `held.since` is reset by a promotion or a move — so a career that goes
 * somewhere keeps developing the person and one that stalls plateaus. That is
 * the intended reading rather than a side effect: `promotionChance` is the thing
 * that starts the clock again.
 */
export const STILL_NEW = 3;
export const STILL_LEARNING = 9;

/**
 * Out of practice is not incapable.
 *
 * `curvedDelta` already tapers a loss to nothing as it approaches zero, so
 * neglect would stop on its own — at about twenty-five, which would mean a
 * thirty-year tech career leaves somebody barely able to hold a conversation.
 * The floor says what the drift actually models: you are rusty at the thing your
 * job never asks of you, not ruined for it.
 */
export const RUSTY_FLOOR = 42;

/** Years in a job before neglect starts to show. */
export const NEGLECT_AFTER = 4;

export interface WorkYearInput {
  readonly track: CareerTrack;
  readonly smarts: number;
  readonly discipline: number;
  readonly charisma: number;
  /** How the year actually went, 0–100, from `performanceYear`. */
  readonly performance: number;
  /** Years in the CURRENT job. Reset by a promotion or a move. */
  readonly years: number;
}

/** What one year of this work is worth, as whole points for `nudgeStats`. */
export function workYearGrowth(input: WorkYearInput): Partial<Record<GrowthStat, number>> {
  const wants = TRACK_WANTS[input.track];
  const held: Record<GrowthStat, number> = {
    smarts: input.smarts,
    discipline: input.discipline,
    charisma: input.charisma,
  };
  const out: Partial<Record<GrowthStat, number>> = {};

  for (const stat of GROWTH_STATS) {
    const weight = wants[stat];
    const value = held[stat];

    if (weight >= USED) {
      const step = learned(value, input.performance, input.years);
      if (step > 0) out[stat] = step;
      continue;
    }
    if (weight <= NEGLECTED && input.years >= NEGLECT_AFTER && value > RUSTY_FLOOR) {
      out[stat] = -1;
    }
  }

  return out;
}

/**
 * Whole points a used stat gains this year.
 *
 * Three coarse bands multiplied out to whole numbers rather than a rate, for the
 * reason the file header gives: a fractional rate rounds to zero and never
 * arrives. The able-and-doing-well gain two; somebody weak at what the job wants
 * has to have a good year to move at all, which is both the honest version and
 * what keeps this from flattening the population the way school did.
 */
function learned(value: number, performance: number, years: number): number {
  if (performance < LEARNS_NOTHING) return 0;
  if (years > STILL_LEARNING) return 0;

  const strong = performance >= LEARNS_MORE;
  const base =
    value >= APT_STRONG
      ? // Already good at it, and the work compounds on that.
        strong
        ? 2
        : 1
      : value >= APT_ORDINARY
        ? 1
        : // Weak at what this job wants. It takes a good year to move at all,
          // which is the half of 13.66 that keeps the bottom of the
          // distribution a real place instead of a starting position.
          strong
          ? 1
          : 0;
  // Past the new-job years it keeps teaching, at half strength — which with
  // whole points means one, and means the second half of a long job is worth
  // less than the first without being worth nothing.
  return years <= STILL_NEW ? base : Math.min(base, 1);
}

/**
 * And what a year with no work at all is worth.
 *
 * 0407 made unemployment reachable on purpose — 0303's living model has real
 * consequences for somebody with no income and they should be possible to
 * meet — and then the only thing an idle year cost was money. A year with
 * nothing to show up for is the clearest thing in a life that takes structure
 * away from somebody, and Discipline is the stat that means structure.
 *
 * ONE POINT, AND ONLY AFTER THE FIRST YEAR. Being between jobs for a year is
 * ordinary and costs nothing; the second and later years are the ones that
 * settle in. Floored like neglect, for the same reason.
 */
export function idleYearDrift(
  discipline: number,
  idleYears: number,
): Partial<Record<GrowthStat, number>> {
  if (idleYears < 2) return {};
  if (discipline <= RUSTY_FLOOR) return {};
  return { discipline: -1 };
}
