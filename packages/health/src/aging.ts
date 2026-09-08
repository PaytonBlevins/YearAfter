/**
 * Ticket 0211 — the curve that makes a life finite.
 *
 * MEASURED FIRST, and the measurement decided the ticket. Eighty lives played to
 * eighty, with the harness working and pushing every year:
 *
 *   HEALTH (p10 / median / p90)
 *     age 10:  43 / 54 / 67
 *     age 20:  38 / 52 / 63
 *     age 30:  38 / 52 / 63
 *     age 40:  38 / 52 / 63
 *     age 50:  38 / 52 / 63
 *     age 60:  38 / 52 / 63
 *     age 70:  38 / 52 / 63
 *     age 80:  38 / 52 / 63
 *   alive at 80: 80 / 80
 *
 * Health was FROZEN from twenty onward — the only thing in the whole build that
 * ever wrote to it was childhood workload overload, and after school there was
 * nothing. The same finding as 0210's cash, one stat over: a bar the player has
 * looked at since 0106 that has never once meant anything.
 *
 * That decides the shape of this file. Adding mortality on top of a frozen stat
 * would produce a flat hazard — the same chance of dying at twenty-five as at
 * ninety — so health has to MOVE before death can depend on it. CORE_RULES 13.25:
 * a threshold is set against the distribution the build actually produces, and
 * the distribution here was a straight line.
 *
 * WHAT THIS IS NOT. It is not a resource the player spends and tops up. Spec 531
 * and 1165 remove routine health-maintenance chores by name, and spec 1030 folds
 * mental health into Happiness and Stress rather than a second bar. Health is a
 * condition that changes with age and with what has happened to you, and the
 * player's only lever is the Doctor.
 *
 * And stress does NOT bill health. 0205 found two systems billing health for one
 * schedule and fixed it by making stress cost happiness and school only — there
 * is a test asserting the stress cost has no `health` key. Chronic stress here
 * raises the CHANCE OF FALLING ILL, which is a different account (CORE_RULES
 * 13.8): it changes a roll rather than subtracting from the bar.
 */

/**
 * The age health stops climbing.
 *
 * Before this a character is still filling out — the measured p10 at ten is 43
 * and at twenty 38, which is childhood workload biting rather than age, so the
 * curve gives those years back rather than piling on.
 */
export const PEAK_AGE = 26;

/** Nothing measurable happens to an ordinary body before this. */
export const DECLINE_STARTS = 32;

/**
 * Where decline stops being gentle.
 *
 * Two slopes rather than one, because one slope cannot be both "barely
 * noticeable at forty" and "the reason people die at eighty". Below this the
 * loss is a fraction of a point a year; above it, it compounds.
 */
export const DECLINE_ACCELERATES = 55;

/** Points a year lost between DECLINE_STARTS and DECLINE_ACCELERATES. */
export const SLOW_DECLINE = 0.45;

/**
 * How much faster each year past DECLINE_ACCELERATES costs.
 *
 * Tuned against a played population, twice. At 0.075 the median character was
 * down to a vitality of 24 by eighty, which drove `frailtyFactor` to 4.4 and
 * pulled the median age at death to sixty-eight — the curve was doing the work
 * mortality was supposed to do. At 0.055 an eighty-year-old sits around 36,
 * which is "not well" rather than "barely here", and the hazard curve is what
 * ends the life. `health.test.ts` asserts the resulting span, not this number.
 */
export const FAST_DECLINE_PER_YEAR = 0.055;

/**
 * Points a year gained before the peak. This is growing up, not a gym.
 *
 * Set against the population rather than the idea (CORE_RULES 13.25). Character
 * generation produces health at p10 38 / median 52 / p90 63, which is a
 * distribution for a CHILD — and every threshold in `health.ts` is about an
 * adult body. At 0.9 a median newborn reaches about 75 by twenty-six, which is
 * what "a healthy adult" has to mean for the mortality curve below to be
 * anything other than a death sentence for everybody.
 */
export const YOUTH_GAIN = 0.9;

/**
 * How much health an ordinary year costs at this age, before anything else.
 *
 * Positive is a loss. Returns a fractional number on purpose: rounding every
 * year to a whole point would make the first decade of decline invisible and
 * then arrive all at once.
 */
export function ageingLoss(age: number): number {
  if (age < PEAK_AGE) return -YOUTH_GAIN;
  if (age < DECLINE_STARTS) return 0;
  if (age < DECLINE_ACCELERATES) return SLOW_DECLINE;
  const past = age - DECLINE_ACCELERATES;
  return SLOW_DECLINE + past * FAST_DECLINE_PER_YEAR;
}

/**
 * How a life is going, in words.
 *
 * Spec 786–795: explain outcomes through context rather than formulas, which is
 * the same rule the school card follows for grades and the Career screen for
 * performance. The player sees the bar and this sentence, never the arithmetic
 * above.
 */
export type HealthBand = 'well' | 'fine' | 'wearing' | 'poor' | 'failing';

export function bandOf(health: number): HealthBand {
  if (health >= 72) return 'well';
  if (health >= 55) return 'fine';
  if (health >= 38) return 'wearing';
  if (health >= 20) return 'poor';
  return 'failing';
}

export const HEALTH_LABELS: Readonly<Record<HealthBand, string>> = {
  well: 'Nothing wrong with you',
  fine: 'Fine, mostly',
  wearing: 'Not what you were',
  poor: 'Something is going on',
  failing: 'You are not well',
};
