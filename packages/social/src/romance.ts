/**
 * Ticket 0207 — Love.
 *
 * Spec 1664: "find date, dating app, flirt, relationship, breakup, marriage.
 * Celebrity dating disabled until fame/network exists."
 *
 * Built on the person model that already exists rather than beside it. A person
 * you are going out with is somebody from your class or your team who you now
 * also have a romance with — they keep their memories, they drift if you stop
 * seeing them, and they end up in the same list of people you used to know.
 * A parallel "partners" model would have meant two places that disagree about
 * whether you still speak to somebody.
 *
 * AGE IS THE FIRST RULE HERE, and it is not a balance knob.
 *
 * Nothing romantic exists below `CRUSH_AGE`. Between there and adulthood the
 * whole system is the one a thirteen-year-old would recognise — asking somebody
 * out, going out, a first date at the cinema, breaking up in a corridor — and
 * the copy stays at exactly the register the childhood catalog already uses.
 * Moving in together, engagement and marriage are gated at `ADULT_AGE` and
 * cannot be reached before it by any route: `stagesFor` will not return them,
 * and `canAdvanceTo` refuses them.
 */

import type { Personality } from '@yearafter/character';
import { clampStat, type StatValue } from '@yearafter/core';
import type { Acquaintance } from './people';

/* -------------------------------------------------------------------------- */
/* Age                                                                         */
/* -------------------------------------------------------------------------- */

/** Below this there is no romance system at all. */
export const CRUSH_AGE = 13;

/**
 * Everything adult is gated here, with no route around it.
 *
 * Moving in, engagement and marriage are not available to a minor in this game
 * at any relationship value, through any action, in any order.
 */
export const ADULT_AGE = 18;

/* -------------------------------------------------------------------------- */
/* Where a relationship is                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `interested` is one-sided — the player's crush, which the other person may
 * know nothing about. Everything after it is mutual.
 */
export type RomanceStage = 'interested' | 'seeing' | 'together' | 'engaged' | 'married';

export const ROMANCE_STAGE_LABELS: Readonly<Record<RomanceStage, string>> = {
  interested: 'You like them',
  seeing: 'Seeing each other',
  together: 'Going out',
  engaged: 'Engaged',
  married: 'Married',
};

export interface Romance {
  readonly stage: RomanceStage;
  /** The player's age when this stage began. */
  readonly since: number;
  /** The player's age when it ended, if it did. */
  readonly endedAtAge?: number;
  readonly endedBecause?: 'broke up' | 'they ended it' | 'drifted' | 'divorced';
}

/** Stages a character of this age may reach. Adult ones are simply absent. */
export function stagesFor(age: number): readonly RomanceStage[] {
  if (age < CRUSH_AGE) return [];
  if (age < ADULT_AGE) return ['interested', 'seeing', 'together'];
  return ['interested', 'seeing', 'together', 'engaged', 'married'];
}

/**
 * Whether this character may move to this stage right now.
 *
 * The age check is first and unconditional. Nothing about how well the
 * relationship is going can move a minor past `together`.
 */
export function canAdvanceTo(stage: RomanceStage, age: number): boolean {
  return stagesFor(age).includes(stage);
}

/**
 * The stage this character may actually be at, given one they are claimed to be
 * at. Never returns anything `stagesFor` does not list for this age.
 *
 * `canAdvanceTo` guards forward motion, and writing the tests found that this is
 * only half a gate: every path that leaves a relationship where it was — a
 * refusal, a bad evening, a light move — handed the existing stage straight
 * back without looking at the age. So the gate stopped a minor MOVING to an
 * adult stage and would have carried one they somehow already held, which is
 * exactly the case a gate exists for. A save from a future version, a migration
 * that got it wrong, a caller that skipped the menu: any of those and the
 * engine would have gone along with it.
 *
 * Clamping down rather than erasing, because a fifteen-year-old whose record
 * claims a marriage is a bug in the record, not a reason to throw away the fact
 * that there is a person there.
 */
export function holdableStage(
  stage: RomanceStage | undefined,
  age: number,
): RomanceStage | undefined {
  if (stage === undefined) return undefined;
  const allowed = stagesFor(age);
  if (allowed.length === 0) return undefined;
  if (allowed.includes(stage)) return stage;
  return allowed[allowed.length - 1];
}

export const isRomantic = (person: Acquaintance): boolean =>
  person.romance !== undefined && person.romance.endedAtAge === undefined;

/** The one person a character is actually with, if there is one. */
export const partnerOf = (people: readonly Acquaintance[]): Acquaintance | undefined =>
  people.find(
    (person) =>
      isRomantic(person) && person.romance?.stage !== 'interested' && person.endedAtAge === undefined,
  );

/** People the player likes who do not yet know it, or do not yet agree. */
export const crushesOf = (people: readonly Acquaintance[]): readonly Acquaintance[] =>
  people.filter(
    (person) =>
      isRomantic(person) && person.romance?.stage === 'interested' && person.endedAtAge === undefined,
  );

export const exesOf = (people: readonly Acquaintance[]): readonly Acquaintance[] =>
  people.filter((person) => person.romance?.endedAtAge !== undefined);

/* -------------------------------------------------------------------------- */
/* Whether it would work                                                       */
/* -------------------------------------------------------------------------- */

/**
 * How well two people actually suit each other, 0–100.
 *
 * Spec 56 removed Family Goals and Fame Pressure from partner compatibility, so
 * what is left is temperament: similar extraversion and loyalty make a couple
 * easy, a large gap in either makes them work for it. Deliberately NOT derived
 * from looks — that is what attraction is for, and a life sim in which the
 * best-looking people are automatically the most compatible would be saying
 * something grim by accident.
 *
 * Hidden. The player finds out by living it, which is spec 786–795.
 */
export function compatibility(mine: Personality, theirs: Personality): number {
  const gap = (a: number, b: number) => Math.abs(a - b) / 100; // 0 .. 1
  const social = 1 - gap(mine.extraversion, theirs.extraversion);
  const steady = 1 - gap(mine.loyalty, theirs.loyalty);
  const temper = 1 - Math.max(0, (mine.temper + theirs.temper - 100) / 100);
  const fit = social * 0.42 + steady * 0.32 + temper * 0.26;
  return clampStat(Math.round(((fit - FIT_FLOOR) / FIT_SPAN) * 100));
}

/**
 * The rescale, and why it is not just `fit * 100`.
 *
 * CORE_RULES 13.7 — measure the inputs before setting a threshold. The first
 * version did not, and the raw fit turned out to sit in a narrow band near the
 * top: 300,000 pairs drawn the way `social-generator` draws peers (every trait
 * uniform 10–90) gave a median of 0.774 and a 5th percentile of 0.566. Scored
 * directly that is a median compatibility of 80, which meant the drift pivot at
 * 52 was below almost every couple in the game, every relationship warmed every
 * year, and the sentence three paragraphs down about first relationships not
 * surviving to eighteen was simply false.
 *
 * Anchored here on that measurement — floor 0.50, span 0.55 — the same 300,000
 * pairs give p5 12, p25 35, median 50, p75 63, p95 79. Compatible and
 * incompatible now both exist, which they did not before.
 */
const FIT_FLOOR = 0.5;
const FIT_SPAN = 0.55;

/**
 * The chance a romantic move lands.
 *
 * Three things, in the order a teenager would rank them: whether they already
 * like you, whether you suit each other, and how you come across. Looks matter
 * and are the smallest of the three, which is both kinder and truer than the
 * alternative.
 */
export function romanceChance(
  person: Acquaintance,
  mine: Personality,
  charisma: number,
  looks: number,
  base: number,
): number {
  const warmth = person.relationship / 100;
  const suited = compatibility(mine, person.personality) / 100;
  const presence = ((charisma - 50) / 50) * 0.1 + ((looks - 50) / 50) * 0.07;
  // COMPATIBILITY OUTWEIGHS WARMTH, and the first version had it the other way
  // round. Reading 150 lives found every one of them marrying the classmate
  // they had sat next to longest: warmth is what years of proximity and four
  // evenings out a year produce, so a menu that scored warmth highest was
  // scoring "have you known them a long time" and calling it love. Liking
  // somebody is not the same as it working, and the gap between those two is
  // most of what this system is for.
  const chance = base + warmth * 0.18 + (suited - 0.5) * 0.42 + presence;
  return chance < 0.05 ? 0.05 : chance > 0.95 ? 0.95 : chance;
}

/**
 * A year of a relationship, when nothing in particular happened.
 *
 * Compatible couples warm slowly; badly matched ones cool. This is what makes a
 * relationship something that happens over years rather than a flag that gets
 * set — and it is why a fifteen-year-old's first relationship usually does not
 * survive to eighteen, which is correct.
 */
export const ROMANCE_DRIFT = 14;

/**
 * The compatibility at which a year changes nothing.
 *
 * Deliberately a little ABOVE the measured median of 50, so a relationship left
 * alone tends slightly downwards. That is the honest version and it is also what
 * gives the date button something to do.
 *
 * Measured over 40,000 relationships started at 55 and run four years — a
 * fifteen-year-old reaching eighteen — at drift 14 and pivot 55: with the player
 * doing nothing, 32% are in trouble and 20% have become strong on their own;
 * with the player taking them out twice a year, 11% are in trouble and 60% are
 * strong. Effort matters enormously and settles nothing, which is the shape this
 * wants. At the original drift of 4 the same sweep put 0% in trouble.
 */
export const ROMANCE_PIVOT = 55;

export function romanceYear(person: Acquaintance, mine: Personality): StatValue {
  const suited = compatibility(mine, person.personality);
  const direction = (suited - ROMANCE_PIVOT) / 48; // -1 .. 1 either side of it
  return clampStat(Math.round(person.relationship + ROMANCE_DRIFT * direction));
}

/** Below this a relationship is in real trouble, and both people know it. */
export const ROMANCE_TROUBLE = 38;

/**
 * The chance the OTHER person ends it this year.
 *
 * Load-bearing, and the reason it exists is a design failure it prevents: with
 * only a break-up button, the player is the only person in the world with any
 * say, every relationship lasts exactly as long as they want it to, and being
 * dumped — which is most of what dating is when you are fifteen — never happens
 * to anybody. That is a shop, not a life.
 *
 * Zero until things are actually bad, then it climbs steeply, and it never
 * reaches certainty: a relationship at rock bottom that both people keep going
 * anyway is a real thing that happens for years.
 */
export const LEAVING_CHANCE_MAX = 0.55;

/** Yearly chance of leaving at total incompatibility, before unhappiness. */
export const MISMATCH_LEAVING = 0.17;

/**
 * It reads COMPATIBILITY as well as warmth, and that is the fix for the worst
 * thing reading the output found.
 *
 * The first version read warmth alone. Warmth is the number the player can pump
 * — four evenings out a year is +23, more than any drift can take back — so
 * 150 lives played by somebody who used the menu ended with 98% still with the
 * first person they asked out at thirteen, at thirty, having never been left by
 * anybody. A life sim in which spending money on somebody guarantees they stay
 * forever is saying something false and quite bleak.
 *
 * So somebody badly matched to you can leave a warm relationship. There is a
 * floor chance every year that does not care how nice the dinners were, and it
 * is set by whether the two of you actually suit each other. That is the thing
 * the player cannot buy, cannot see, and finds out by living it (spec 786–795).
 */
/**
 * The extra yearly chance a relationship ends because both people are still
 * becoming who they are.
 *
 * Reading 150 lives found 73% of them containing exactly ONE relationship, and
 * 74% of thirty-year-olds still with the person they asked out at thirteen.
 * Nothing in the model knew that a fourteen-year-old and a twenty-two-year-old
 * are different people — a teenage relationship was simply an adult one with
 * younger copy, and would run for sixteen years on compatibility alone.
 *
 * People change enormously between thirteen and the early twenties and much
 * less afterwards, so this is steepest at the start and gone by `SETTLED_AGE`.
 * It is not a punishment and it is not a cap: a first love CAN last, it just
 * has to survive both of you growing up, which is the actual reason most of
 * them do not.
 */
export const GROWING_APART = 0.2;
export const SETTLED_AGE = 23;

export function growingApart(age: number): number {
  if (age >= SETTLED_AGE) return 0;
  const left = (SETTLED_AGE - Math.max(CRUSH_AGE, age)) / (SETTLED_AGE - CRUSH_AGE); // 1 .. 0
  return left * left * GROWING_APART;
}

export function leavingChance(relationship: number, suited: number, age = SETTLED_AGE): number {
  // Badly matched: a real chance every year, whatever the warmth. Well matched:
  // none of this applies and only genuine unhappiness ends it.
  // Linear, not squared. Squared was measured and was worth nothing: at the
  // 25th-percentile compatibility of 35 it came to 1.8% a year, which over the
  // twelve adult years this build simulates is a 20% chance of anything ever
  // happening — so 99% of lives still ended at thirty with the person they
  // asked out at thirteen. Linear puts the same couple at 6% a year, which is
  // about even odds across those twelve years, and that is the intended shape:
  // a badly matched couple probably does not make it, and might.
  const mismatch = Math.max(0, (ROMANCE_PIVOT - suited) / ROMANCE_PIVOT); // 0 .. 1
  const floor = mismatch * MISMATCH_LEAVING + growingApart(age);

  if (relationship >= ROMANCE_TROUBLE) return Math.min(LEAVING_CHANCE_MAX, floor);
  const depth = (ROMANCE_TROUBLE - relationship) / ROMANCE_TROUBLE; // 0 .. 1
  return Math.min(LEAVING_CHANCE_MAX, floor + depth * depth * LEAVING_CHANCE_MAX * 1.6);
}
