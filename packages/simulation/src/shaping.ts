/**
 * Ticket 0415 — what the rest of a life does to you.
 *
 * Roadmap finding 2c, 0411's leftover: *"study, a hobby, raising a child and
 * being ill are all things that change a person, and none of them touch a stat
 * in adulthood."* Measured on 192 played lives, paired per life from twenty-five
 * to fifty:
 *
 * | | willpower | discipline |
 * |---|---|---|
 * | eight+ years raising a young child | +13.1 | −3.0 |
 * | never | +12.4 | −2.8 |
 * | five+ years seriously ill | +12.2 | −4.3 |
 * | never | +12.9 | −2.3 |
 * | five+ years running on empty | **+15.7** | −0.8 |
 * | never | +11.9 | −3.3 |
 *
 * Raising a child for a decade and being seriously ill for five years both left
 * a person exactly where they would have been anyway. And the last row is the
 * wrong way round: a character who spent five years struggling came out of them
 * with MORE willpower than one who never did.
 *
 * One of the four was wrong: study does move a person. `runCollegeYear` has
 * paid +2 Smarts a year since 0210b, and adults who studied gained +4.0 against
 * −2.3 for those who did not. The hobby is the fourth, and it cannot be written
 * here — see the 0415 ticket doc: there is no adult state for a hobby to be.
 *
 * WHICH STAT, AND WHY NOT A THIRD SET OF NUMBERS. Willpower is what
 * `resilience` in the stress package reads to decide how hard a year lands
 * (`1 − willpower × 0.35`),
 * so it is the stat that means how much a person can carry — and what carrying
 * things does to you is exactly what these three are about. Discipline is the
 * stat that means structure, and a small child imposes one on anybody.
 *
 * TWO-SIDED, OR IT IS 13.70 AGAIN. Every function here can take something away,
 * and the thing that decides which way it goes is the year itself: a year spent
 * struggling (`stressBand` ≥ struggling, the existing band rather than a new
 * threshold) is the year that wears you, and a year you held together is the
 * one that builds you. The same illness hardens one person and wears another,
 * and the build could not say so.
 *
 * Whole points, for 0411's reason: `curvedDelta` rounds, so anything fractional
 * never arrives. Pure: no randomness, no state.
 */

import { RUSTY_FLOOR } from '@yearafter/careers';
import { findActivity } from '@yearafter/content';
import type { EnrolledActivity } from '@yearafter/education';
import { findCondition, type HeldCondition, type Severity } from '@yearafter/health';
import { childrenAtHome } from '@yearafter/parenting';
import type { Household } from '@yearafter/relationships';
import { stressBand } from '@yearafter/stress';

export type ShapedStat = 'willpower' | 'discipline' | 'smarts' | 'charisma' | 'happiness';
export type Shaping = Partial<Record<ShapedStat, number>>;

/** A year at or above `struggling` is one that costs you rather than builds you. */
export const strained = (stressLevel: number): boolean => {
  const band = stressBand(stressLevel);
  return band === 'struggling' || band === 'overwhelmed';
};

/**
 * Worn is not broken, and the floor is 0411's rather than a copy of it.
 *
 * Imported, not restated: a second `42` in a second package is the four-places
 * table of CORE_RULES 13.78 starting again from two.
 */
export const WORN_FLOOR = RUSTY_FLOOR;

const wear = (value: number): Shaping => (value > WORN_FLOOR ? { willpower: -1 } : {});

/* ---- raising a child ------------------------------------------------------ */

/** The years a child imposes a routine on the people raising it. */
export const ROUTINE_YEARS = 6;
/** And the years they are still a child you are carrying. */
export const CARRYING_YEARS = 13;

export interface ParentingYearInput {
  /** Age of the youngest child living at home, or undefined for none. */
  readonly youngestAtHome: number | undefined;
  readonly stress: number;
  readonly willpower: number;
}

/**
 * A small child is the most reliable structure-giver a life contains: the
 * feeds, the school run and the bedtime happen whether you feel like it or not.
 * So Discipline, in the years before school — and only in a year you were
 * holding together, because the same small child in a year you were running on
 * empty is not building anything in you. That year costs Willpower instead,
 * which is what four hours of sleep for a year actually does.
 *
 * Nothing past thirteen. A teenager is a different weight and the events cover
 * it; this is about the years that are physically relentless.
 */
export function parentingYearGrowth(input: ParentingYearInput): Shaping {
  const youngest = input.youngestAtHome;
  if (youngest === undefined || youngest >= CARRYING_YEARS) return {};
  if (strained(input.stress)) return wear(input.willpower);
  return youngest < ROUTINE_YEARS ? { discipline: 1 } : {};
}

/* ---- being ill ------------------------------------------------------------ */

/**
 * The years in which you learn to live with it.
 *
 * Not the first — a diagnosis year is shock, and the events (0409's `health.*`)
 * already cover it. Not forever either: thirty years of high blood pressure is
 * not thirty years of becoming anybody, it is just your life, and a condition
 * held for decades would otherwise be a willpower machine.
 */
export const LEARNING_TO_LIVE_WITH = { from: 1, to: 6 } as const;

/** Above this, meeting it well compounds on what is there. */
export const HARDENS = 60;
/** Below this, it wears through what little there is. */
export const FRAYS = 45;

export interface IllnessYearInput {
  /** The worst held condition, if any. Minor conditions do not count. */
  readonly worst: Severity | undefined;
  /** Years the worst condition has been held. */
  readonly yearsHeld: number;
  readonly stress: number;
  readonly willpower: number;
}

/**
 * The same illness makes one person and breaks another, and the thing that
 * decides it is not the illness.
 *
 * Deliberately NOT keyed on `treated`. Treatment is only ever set by the Doctor
 * button (`doctor.ts`), so a rule that paid out on treatment would pay a player
 * who taps and never a player who does not — the button-only door 0410 found
 * three of. What decides it here is who the character already is, and how the
 * year went.
 */
export function illnessYearGrowth(input: IllnessYearInput): Shaping {
  if (input.worst === undefined || input.worst === 'minor') return {};
  if (input.yearsHeld < LEARNING_TO_LIVE_WITH.from) return {};
  if (input.yearsHeld > LEARNING_TO_LIVE_WITH.to) return {};
  if (strained(input.stress) || input.willpower < FRAYS) return wear(input.willpower);
  return input.willpower >= HARDENS ? { willpower: 1 } : {};
}

/* ---- running on empty ----------------------------------------------------- */

export interface StrainYearInput {
  /** Stress at the end of LAST year. */
  readonly before: number;
  /** Stress at the end of this one. */
  readonly after: number;
  readonly willpower: number;
}

/**
 * The second year in a row spent struggling costs something.
 *
 * The first does not: one hard year is ordinary, and the stress phase already
 * bills happiness for it (`stressConsequences`). It is the one that does not
 * end that wears a person down — and before this, nothing in the build could
 * say so. Five such years measured as a willpower GAIN over a calm life, because
 * every source of willpower an adult has is an event and struggling people meet
 * more events.
 */
export function strainYearWear(input: StrainYearInput): Shaping {
  return strained(input.before) && strained(input.after) ? wear(input.willpower) : {};
}

/* ---- something you do (Ticket 0416) -------------------------------------- */

/**
 * The seasons in which a pursuit is still teaching you something.
 *
 * 0411's shape for work, taken as read: a first year anywhere teaches more than
 * a fifteenth, and a pursuit held for decades would otherwise be a machine for
 * pushing one stat at the ceiling. After this it is simply part of your week —
 * which is still worth the happiness, and still worth the people.
 */
export const STILL_TAKING_UP = 5;

/** The traits a pursuit can build. Health is the health phase's, looks is age's. */
const PURSUIT_TRAITS = ['smarts', 'charisma', 'willpower', 'discipline'] as const;

export interface PursuitYearGrowthInput {
  /** The catalog's effect profile — read for WHICH stat, never for how much. */
  readonly profile: Partial<Record<string, number>>;
  /** Seasons held, counting this one. */
  readonly seasons: number;
  readonly stress: number;
}

/**
 * The hobby half of finding 2c, which 0415 could not build because there was
 * nothing for a hobby to be.
 *
 * One point a year to the one trait the pursuit is most about, for its first
 * five seasons, in a year you held together — and a point of happiness in any
 * year you did, for as long as you keep going. A year spent struggling builds
 * nothing and costs nothing here: the strain rule already bills it, once.
 */
export function pursuitYearGrowth(input: PursuitYearGrowthInput): Shaping {
  if (strained(input.stress)) return {};
  let top: (typeof PURSUIT_TRAITS)[number] | undefined;
  let best = 0;
  for (const trait of PURSUIT_TRAITS) {
    const weight = input.profile[trait] ?? 0;
    if (weight > best) {
      best = weight;
      top = trait;
    }
  }
  const out: Record<string, number> = { happiness: 1 };
  if (top && input.seasons >= 1 && input.seasons <= STILL_TAKING_UP) out[top] = 1;
  return out as Shaping;
}

/* ---- the year's total ----------------------------------------------------- */

/**
 * What the year did, once per stat.
 *
 * Summed and then held to one point either way, because the three rules above
 * share a cause. A second struggling year with a toddler and a diagnosis is ONE
 * year of being worn down, and billing it three times is the two-systems-one-
 * account mistake the stress package already made once with health (see
 * `stressConsequences`). A year moves each of these by one, or not at all.
 */
export function yearShaping(...parts: readonly Shaping[]): Shaping {
  const out: Record<string, number> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value) out[key] = (out[key] ?? 0) + value;
    }
  }
  for (const key of Object.keys(out)) {
    const value = out[key]!;
    if (value === 0) delete out[key];
    else out[key] = value > 0 ? 1 : -1;
  }
  return out as Shaping;
}

/* ---- reading a year ------------------------------------------------------- */

/** From eighteen. A childhood is shaped by school and the events, not by this. */
export const SHAPED_FROM = 18;

const RANK: Readonly<Record<Severity, number>> = { minor: 0, serious: 1, grave: 2 };

export interface LifeYearInput {
  readonly age: number;
  readonly worldYear: number;
  readonly family: Household;
  readonly conditions: readonly HeldCondition[];
  readonly stressBefore: number;
  readonly stressAfter: number;
  readonly willpower: number;
  /**
   * What they are in, after this year's seasons. Only adult pursuits count —
   * a school activity already pays its own effects in the school year.
   */
  readonly activities?: readonly EnrolledActivity[];
}

/**
 * The three rules, read off the year as `advanceYear` sees it.
 *
 * The stress is the year's closing level, the same number the stress phase
 * summarised the year into; the conditions are what the health phase left held.
 * Kept separate from the rules so they stay testable as plain numbers.
 */
export function lifeShaping(input: LifeYearInput): Shaping {
  if (input.age < SHAPED_FROM) return {};

  const ages = childrenAtHome(input.family, input.worldYear).map(
    (child) => input.worldYear - child.birthYear,
  );
  const youngestAtHome = ages.length > 0 ? Math.min(...ages) : undefined;

  let worst: HeldCondition | undefined;
  let worstRank = -1;
  for (const held of input.conditions) {
    const kind = findCondition(held.conditionId);
    if (kind && RANK[kind.severity] > worstRank) {
      worst = held;
      worstRank = RANK[kind.severity];
    }
  }
  const severity = worst ? findCondition(worst.conditionId)?.severity : undefined;

  return yearShaping(
    parentingYearGrowth({ youngestAtHome, stress: input.stressAfter, willpower: input.willpower }),
    illnessYearGrowth({
      worst: severity,
      yearsHeld: worst ? input.age - worst.since : 0,
      stress: input.stressAfter,
      willpower: input.willpower,
    }),
    strainYearWear({
      before: input.stressBefore,
      after: input.stressAfter,
      willpower: input.willpower,
    }),
    ...(input.activities ?? []).flatMap((entry) => {
      const activity = findActivity(entry.activityId);
      if (!activity?.requires.stages.includes('adult')) return [];
      return [
        pursuitYearGrowth({
          profile: activity.effects,
          seasons: entry.seasons,
          stress: input.stressAfter,
        }),
      ];
    }),
  );
}
