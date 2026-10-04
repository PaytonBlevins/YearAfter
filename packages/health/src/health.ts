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

import { cumulativeAgeingLoss } from './aging';
import type { HeldCondition } from './conditions';
import { hazardWith } from './conditions';

/* -------------------------------------------------------------------------- */
/* Constitution (Ticket 0417)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The peak an ordinary body reaches, measured: median vitality at twenty-five
 * across 200 played lives was 79.
 */
export const TYPICAL_PEAK = 80;

/**
 * What this body was built like, read back from where it is and how old it is.
 *
 * Vitality is the only part of health nothing gives back, and after the peak
 * it falls by exactly `cumulativeAgeingLoss` — so adding that back recovers the
 * peak the body started from. It costs no state and cannot drift from the
 * curve it is the inverse of.
 *
 * Ticket 0417 reads it to decide how fast a body heals (`naturalRecovery`).
 */
export function constitutionOf(vitality: number, age: number): number {
  return vitality + cumulativeAgeingLoss(age);
}

/**
 * How this body stands against an ordinary one of the same age.
 *
 * The one reading `deathChance` takes of health. Before 0417 it took the raw
 * number, and the raw number falls with age for everybody — so the age curve
 * was counted TWICE, once in the Gompertz term and again through a frailty
 * multiplier that every seventy-five-year-old maxed out whatever they were
 * built like. Measured: frailty at seventy-five ran 2.8 for the most robust
 * fifth and 10.0 for the frailest; by then there was nothing left to tell them
 * apart, and the whole population died between seventy and seventy-six.
 */
export const healthForAge = (health: number, age: number): number =>
  health + cumulativeAgeingLoss(age);

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
 * is not. The range is wide because "ill" covers two weeks in bed and three
 * months of not being right.
 */
export const ILLNESS_COST: readonly [number, number] = [4, 14];

/* -------------------------------------------------------------------------- */
/* Getting better (Ticket 0417)                                                */
/* -------------------------------------------------------------------------- */

/**
 * What heals on its own in a year, before a doctor.
 *
 * Moved here from the simulation's health phase, where it was a flat 3.4
 * points a year for everybody — written, in its own docblock, as "what makes an
 * acute illness a dip rather than a debt... without this the model would be a
 * ratchet, and a ratchet reaches zero."
 *
 * It was a ratchet from sixty. Illness gets likelier every year after
 * thirty-five and a flat recovery does not, so around sixty-five the average
 * year's illness outran the year's healing and the deficit never came down
 * again: median deficit 4 at forty, 15 at sixty, 25 at seventy, 33 at eighty.
 * At seventy the median body's age curve said 55 and the player's bar said 26
 * — MORE THAN HALF of the health lost by seventy was illness that never healed,
 * and it was the same arithmetic for every body in the game.
 *
 * Two changes, and both are what a body actually does:
 *
 *  - A SHARE, not only a flat amount. A bigger debt comes down faster in
 *    absolute terms, so the deficit has a level it settles at rather than a
 *    road to zero. `HEAL_SHARE` of whatever is owed, on top of the old base.
 *  - SCALED BY CONSTITUTION. A strong body heals faster and a frail one
 *    slower, bounded both ways. Constitution, not current vitality: age already
 *    reaches healing through illness getting likelier, and counting it here too
 *    would be the double count 0417 exists to remove.
 *
 * The second half is small and it was nearly cut for being small. On one sample
 * it moved the gap between the frailest and most robust fifths by a year, which
 * looked like noise. Measured again on two disjoint samples it is consistent:
 * 8 and 9 years with it, 7 and 7 without — and the build before this ticket read
 * 6 and 4, so without it the fix sat exactly on the line it has to clear. One
 * sample could not tell a small real effect from nothing (CORE_RULES 13.81).
 *
 * `HEALING_RANGE` does not bind for anybody the game generates (the frailest
 * constitution is about 0.7 of typical); it is there so a later ticket that
 * widens birth health cannot make somebody heal ten times faster.
 */
export const RECOVERY_BASE = 3.4;
export const HEAL_SHARE = 0.3;
export const HEALING_RANGE: readonly [number, number] = [0.5, 1.4];

export function naturalRecovery(deficit: number, constitution: number): number {
  const [low, high] = HEALING_RANGE;
  const scale = Math.max(low, Math.min(high, constitution / TYPICAL_PEAK));
  return (RECOVERY_BASE + Math.max(0, deficit) * HEAL_SHARE) * scale;
}

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

/**
 * What a genuinely strong body is worth (Ticket 0408).
 *
 * THIS SIDE OF THE CURVE DID NOT EXIST, and the docblock above said so
 * deliberately: "being well is not a bonus, it is the baseline". That was a
 * reasonable call when the population had nothing above the baseline to
 * measure — birth health ran p10 45 / p90 69 and almost nobody was meaningfully
 * robust. 0408 widened the roll to p10 34 / p90 77 and the flatness became
 * visible instead: across a SIXTY-EIGHT point range of birth health, median age
 * at death moved from 70 to 74 — four years, and not even monotonically.
 *
 * That is the same finding 0212 recorded for NPCs and fixed only for them: at a
 * cautious spread "the spread in life expectancy across a thousand
 * constitutions was 4.9 years, which is another way of saying constitution did
 * not exist". The player's own model still had it, because a one-sided
 * multiplier can express "this body is failing" and cannot express "this body
 * is unusually good".
 *
 * Bounded well short of immortality: the floor is a multiplier, the Gompertz
 * curve underneath it still doubles every seven and a half years, and a robust
 * ninety-year-old is still a ninety-year-old.
 */
export const ROBUST_FLOOR = 0.58;

export function frailtyFactor(health: number): number {
  if (health >= HEALTHY_ADULT) {
    const above = Math.min(100, health) - HEALTHY_ADULT;
    const room = 100 - HEALTHY_ADULT;
    return Math.max(ROBUST_FLOOR, 1 - (above / room) * (1 - ROBUST_FLOOR));
  }
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
  // Ticket 0417: the body FOR ITS AGE. The Gompertz term above is the age; this
  // is everything else. See `healthForAge`.
  const risk = (SUDDEN + byAge) * frailtyFactor(healthForAge(health, age)) * hazardWith(conditions);
  /*
    THE FLOOR IS A FLOOR (Ticket 0408). `frailtyFactor` can now return less than
    one for a genuinely robust body, and without this clamp that discount would
    also apply to `SUDDEN` — which is accidents. A strong constitution does not
    make a car crash less likely, and `health.test.ts` caught it immediately:
    a perfectly well twenty-year-old came out below the sudden-death floor the
    model exists to guarantee. Robustness buys you odds against the things that
    accumulate, and nothing at all against the things that do not.
  */
  return Math.min(0.97, Math.max(SUDDEN, risk));
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

/* -------------------------------------------------------------------------- */
/* Ticket 0411 — a face that ages                                              */
/* -------------------------------------------------------------------------- */

/**
 * The age Looks stops holding still.
 *
 * Measured across 80 played lives before this ticket: **Looks ran 52 at
 * eighteen, 52 at thirty and 52 at forty-five.** Nothing in the build has ever
 * written that stat after character generation — not school, not work, not
 * illness, not one of the 444 events in the catalog, which offer it +0 and −0 at
 * forty. It is a bar the player has been looking at since 0106 and a constant,
 * which is CORE_RULES 13.36 for the fourth time: a field nothing writes is not
 * state, it is a promise.
 *
 * Twenty-eight rather than eighteen, because a twenty-two-year-old's face is not
 * declining and a model that said so would be both wrong and unpleasant.
 */
export const LOOKS_HOLDS_UNTIL = 28;

/**
 * How a year of it lands, as whole points for `nudgeStats`.
 *
 * ONE POINT EVERY FEW YEARS, NOT A RATE, for the reason 0408 recorded and 0411
 * ran into again: `curvedDelta` rounds to whole points, so a fractional decline
 * floors to zero and never arrives. The interval is what carries the rate, and
 * it is keyed on AGE so it consumes no randomness and a reload cannot change how
 * somebody has aged.
 *
 * HEALTH SETS THE INTERVAL, which is the whole reason this belongs in the health
 * package rather than being a bare age term. Somebody who has kept themselves
 * well ages more slowly than somebody who has not, and that is a statement the
 * build can now make honestly because 0408 gave constitution a real range. The
 * curve does the rest: `curvedDelta` tapers a loss to nothing as it approaches
 * zero, so this asymptotes rather than needing a floor bolted on.
 */
export function looksDrift(age: number, health: number): number {
  if (age <= LOOKS_HOLDS_UNTIL) return 0;
  const every = health >= HEALTHY_ADULT + 15 ? 4 : health >= HEALTHY_ADULT ? 3 : 2;
  return age % every === 0 ? -1 : 0;
}
