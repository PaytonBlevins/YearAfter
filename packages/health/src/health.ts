/**
 * Ticket 0211 — falling ill, getting hurt, and dying.
 *
 * The three rolls a year makes, in the order they happen, and every rate in here
 * was set against a measured population rather than against what the word means
 * (CORE_RULES 13.25). The measurements are in the comments beside the constants
 * and asserted in `health.test.ts`.
 *
 * The hard constraint is spec 559: *"Unexpected sudden death in otherwise
 * healthy characters should almost never occur."* That is not a tuning
 * preference, it is a rule about how the game is allowed to feel — a life sim
 * that kills a healthy twenty-six-year-old with no warning has taught the player
 * that nothing they do matters. So the hazard below is built the other way
 * round: it starts at a number that rounds to never and climbs.
 */

import type { HeldCondition } from './conditions';
import { hazardWith } from './conditions';

/* -------------------------------------------------------------------------- */
/* Falling ill                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The yearly chance of being ill at all, for a healthy adult.
 *
 * Most of these come to nothing but a line in the feed and a few points that
 * come back. It is deliberately COMMON — being ill is ordinary, and a game where
 * illness is rare makes each one an event rather than a year.
 */
export const ILLNESS_BASE = 0.13;

/** Age past which illness starts finding you more often. */
export const ILLNESS_AGE_FROM = 35;
/** Added to the chance per year past `ILLNESS_AGE_FROM`. */
export const ILLNESS_PER_YEAR = 0.0075;

/**
 * How much low health invites the next thing.
 *
 * At health 100 this contributes nothing; at health 20 it adds most of the base
 * again. Being run down is how a bad year turns into a bad decade, and it is the
 * ONLY compounding loop in the model — which is why it was measured and then
 * softened. At 0.14 the bottom decile was at health 23 by sixty and dead by
 * fifty-seven, because falling ill made falling ill likelier and there was
 * nothing pulling the other way.
 */
export const ILLNESS_FRAILTY = 0.1;

/**
 * How much chronic stress contributes.
 *
 * Stress does NOT bill health — 0205 removed that and there is a test asserting
 * it (CORE_RULES 13.8). What stress does here is change a ROLL, which is a
 * different account: a character living at stress 60 catches more than one
 * living at 10, and still loses no health directly to it.
 */
export const ILLNESS_STRESS = 0.12;

export interface IllnessOdds {
  readonly age: number;
  readonly health: number;
  readonly stress: number;
}

export function illnessChance({ age, health, stress }: IllnessOdds): number {
  const byAge = Math.max(0, age - ILLNESS_AGE_FROM) * ILLNESS_PER_YEAR;
  const byFrailty = ((100 - health) / 100) * ILLNESS_FRAILTY;
  const byStress = (stress / 100) * ILLNESS_STRESS;
  return Math.min(0.72, ILLNESS_BASE + byAge + byFrailty + byStress);
}

/**
 * Health lost to a year of being ill, before it comes back.
 *
 * Acute illness is a dip, not a debt: `ageingLoss` is what accumulates and this
 * is not. The range is wide because "ill" covers a fortnight in bed and three
 * months of not being right.
 */
export const ILLNESS_COST: readonly [number, number] = [4, 14];

/**
 * The chance a year of illness leaves something permanent behind.
 *
 * The whole reason acute illness is modelled at all. At 0.11 with the rates
 * above, a measured life picks up its first condition in its fifties and holds
 * one or two by eighty — see the distribution printed by `health.test.ts`.
 */
export const LINGERS = 0.11;

/** Past this age an illness is much likelier to stay. Bodies stop bouncing. */
export const LINGERS_AGE_FROM = 50;
export const LINGERS_PER_YEAR = 0.006;

export function lingerChance(age: number): number {
  return Math.min(0.45, LINGERS + Math.max(0, age - LINGERS_AGE_FROM) * LINGERS_PER_YEAR);
}

/* -------------------------------------------------------------------------- */
/* Getting hurt                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Spec 541–543, as three numbers in the order the spec puts them:
 *
 *   1. athletes — "main group, but still not overly frequent";
 *   2. blue-collar / hazardous workers — "very rare";
 *   3. everyday people — "extremely rare".
 *
 * The ratios matter more than the absolutes, and `health.test.ts` asserts the
 * ORDER holds in a played population rather than trusting these three lines —
 * which is 0210's lesson about a rule that was true in the constant and false in
 * the game.
 */
export const INJURY_ATHLETE = 0.035;
export const INJURY_HAZARDOUS = 0.011;
export const INJURY_ORDINARY = 0.0025;

/**
 * Of injuries, the share that leave something permanent.
 *
 * "Permanent injuries are rarer still" — so most of even the rare thing is a bad
 * year rather than a changed life.
 */
export const INJURY_PERMANENT = 0.22;

export interface InjuryExposure {
  /** In a sport or physical activity this year. */
  readonly athlete: boolean;
  /** Working a trade, a warehouse, a kitchen, a site. */
  readonly hazardous: boolean;
}

export function injuryChance({ athlete, hazardous }: InjuryExposure): number {
  if (athlete) return INJURY_ATHLETE;
  if (hazardous) return INJURY_HAZARDOUS;
  return INJURY_ORDINARY;
}

/** Health lost to an injury. Sharper than illness, and it heals. */
export const INJURY_COST: readonly [number, number] = [8, 22];

/* -------------------------------------------------------------------------- */
/* Dying                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The floor: the chance an entirely healthy adult dies in a year anyway.
 *
 * Spec 559 — "unexpected sudden death in otherwise healthy characters should
 * almost never occur". One in four thousand is the honest reading of "almost
 * never": across a forty-year adulthood a healthy character has about a 1% chance
 * of it ever happening, so it exists in the world and almost never happens to
 * you. Setting it to zero would be a different lie.
 */
export const SUDDEN = 0.00025;

/**
 * Where age-driven mortality starts being a real number, and how fast it doubles.
 *
 * A Gompertz-shaped curve, which is what human mortality actually is: negligible
 * for decades and then doubling every seven or eight years. `MORTALITY_AT_60`
 * anchors it and `DOUBLES_EVERY` sets the slope, so the two constants can be
 * reasoned about separately — one says "how likely at sixty", the other "how
 * fast after that".
 */
export const MORTALITY_AT_60 = 0.0034;
export const DOUBLES_EVERY = 7.5;

/**
 * The health an ordinary adult in THIS build actually has.
 *
 * Measured, not assumed, and the first version of `frailtyFactor` got it wrong
 * in exactly the way CORE_RULES 13.25 warns about: it treated 70 as the healthy
 * baseline because seventy sounds healthy. The played population sits at median
 * 66 at twenty and 64 at forty, so "below 70 is frail" made every character in
 * the game frail for their entire adult life, and the median age at death came
 * out at SIXTY-THREE.
 *
 * Everything at or above this is simply well. The multiplier is for people who
 * are genuinely below where a body of their age should be.
 */
export const HEALTHY_ADULT = 62;

/**
 * How much poor health multiplies the year's odds.
 *
 * At health 70+ this is 1 — being well is not a bonus, it is the baseline. It
 * climbs sharply below 40, which is where the condition ceilings put a character
 * who has collected something serious.
 */
export const FRAILTY_SLOPE = 9;

export function frailtyFactor(health: number): number {
  if (health >= HEALTHY_ADULT) return 1;
  const below = HEALTHY_ADULT - health;
  return 1 + (below / HEALTHY_ADULT) ** 2 * FRAILTY_SLOPE;
}

/**
 * The age below which something grave is genuinely unusual.
 *
 * Measured: with an unweighted draw over the eight illness conditions, two of
 * which are grave, 5% of characters were dead before forty — because a
 * twenty-eight-year-old could pick up a condition with a ceiling of 42 and a
 * hazard of 4.2 from an ordinary bad winter. That is not spec 559's "almost
 * never", and it is not what happens to people.
 *
 * So severity is drawn against age. Below this, grave conditions are mostly
 * filtered out and serious ones thinned; the filter fades to nothing by
 * `GRAVE_FULLY_BY`, after which a body can get anything.
 */
export const GRAVE_FROM = 45;
export const GRAVE_FULLY_BY = 68;

/** 0 at `GRAVE_FROM` and below, 1 at `GRAVE_FULLY_BY` and above. */
export function severityOpenness(age: number): number {
  if (age <= GRAVE_FROM) return 0;
  if (age >= GRAVE_FULLY_BY) return 1;
  return (age - GRAVE_FROM) / (GRAVE_FULLY_BY - GRAVE_FROM);
}

export interface MortalityOdds {
  readonly age: number;
  readonly health: number;
  readonly conditions: readonly HeldCondition[];
}

/**
 * The chance this year is the last one.
 *
 * Deliberately readable as three separate factors — age, how well you are, and
 * what is wrong with you — because when the measured lifespan comes out wrong
 * the fix has to be findable. A single fitted polynomial would be shorter and
 * impossible to tune.
 */
export function deathChance({ age, health, conditions }: MortalityOdds): number {
  const byAge = MORTALITY_AT_60 * 2 ** ((age - 60) / DOUBLES_EVERY);
  const risk = (SUDDEN + byAge) * frailtyFactor(health) * hazardWith(conditions);
  return Math.min(0.97, risk);
}

/* -------------------------------------------------------------------------- */
/* Seeing a doctor                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What a check-up is worth.
 *
 * Spec 531 and 1165: "preventive routine care should matter little/mostly
 * backend and must not become chores". So this is ONE button, once a year, and
 * it is worth something small and real rather than something the player would
 * feel obliged to press — a few points back, and each condition being treated
 * gets its yearly roll at clearing.
 *
 * The alternative — a check-up worth ten points — would make skipping it a
 * mistake, and a button you are punished for not pressing every year for eighty
 * years is the definition of the chore the spec removes.
 */
export const CHECKUP_RECOVERY: readonly [number, number] = [2, 6];

/** A check-up also catches things: the chance it finds something treatable early. */
export const CHECKUP_CATCHES = 0.35;
