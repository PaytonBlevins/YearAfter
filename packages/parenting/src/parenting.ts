/**
 * Ticket 0208 — Children.
 *
 * Spec 1666: "pregnancy, birth, adoption, child aging."
 *
 * TWO RULES SHAPE EVERYTHING HERE, and both come from the spec rather than
 * from taste.
 *
 * The first is spec 61, which is unusually specific about what the player may
 * NOT do as a parent: no paying for activities, no discipline button, no fund
 * college, no refuse assistance, no buy vehicle, no provide housing. What it
 * adds instead is that "children should ask for activities. If the player
 * approves, the child joins" — plus Kick Out of House. Spec 1813 says the same
 * thing in one line: player-parent interactions stay LIGHTWEIGHT.
 *
 * So a child in this game is not a project the player manages. A child is
 * somebody who turns up, grows, asks for things, and either gets your attention
 * or does not. Everything the parent does is answering, and spec 1986 abstracts
 * the rest — "most childcare is abstracted unless a meaningful event occurs".
 *
 * The second rule is age, and it is the same one Ticket 0207 established: this
 * is adult-only, gated in one function that everything reads, with no route
 * around it at any relationship value or through any action.
 */

import type { Personality, Sex } from '@yearafter/character';
import { clampStat, dollars, type Money, type StatValue } from '@yearafter/core';
import type { FamilyMember, Household } from '@yearafter/relationships';
import { livingChildren } from '@yearafter/relationships';

/* -------------------------------------------------------------------------- */
/* Age                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Nothing in this system exists below this age. Not gated, not discouraged —
 * absent, the way `stagesFor` makes romance absent below thirteen.
 *
 * This is a hard rule and not a balance knob, and it is deliberately the same
 * constant Ticket 0207 uses for engagement and marriage, so the two can never
 * drift apart into a state where the game will marry somebody it will not let
 * become a parent, or the reverse.
 */
export const PARENT_AGE = 18;

/** Whether this character may have children at all. The only age check. */
export const canBecomeParent = (age: number): boolean => age >= PARENT_AGE;

/* -------------------------------------------------------------------------- */
/* Fertility                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The chance a year of trying results in a pregnancy, by the player's age.
 *
 * Spec 1972 puts fertility, IVF and surrogacy in the Health milestone, so this
 * is deliberately the simple version: one curve, no treatments, no diagnosis.
 * What it has to get right is the SHAPE — high and flat through the twenties,
 * falling through the thirties, gone by the mid-forties — because a flat
 * chance would mean age never costs the player anything, and "we left it late"
 * is one of the few genuinely consequential decisions a life sim can offer.
 *
 * Deliberately kinder than the real curve, for the reason spec 949 gives about
 * wealth: the game should be fun at every level, and a player who starts trying
 * at thirty-eight should be unlucky rather than doomed.
 */
export const PEAK_FERTILITY = 0.55;
export const FERTILITY_ENDS = 46;

/**
 * A pregnancy takes a year, so the announcement and the birth are two
 * different moments in the feed rather than one line that does both.
 *
 * It is also most of the balance. Measured across 20,000 lives: without it, a
 * player who pressed the button every year from twenty-two ended up with 5.7
 * children, because every year was an independent roll and they compound. With
 * a year of gestation and the crowding below, the same player has 3.3 — a big
 * family somebody chose, rather than a number nobody meant.
 */
export const GESTATION_YEARS = 1;

export function fertility(age: number): number {
  if (age < PARENT_AGE || age >= FERTILITY_ENDS) return 0;
  if (age <= 28) return PEAK_FERTILITY;
  // Falls away smoothly rather than in steps, so no birthday is a cliff.
  const past = (age - 28) / (FERTILITY_ENDS - 28); // 0 .. 1
  return PEAK_FERTILITY * (1 - past * past);
}

/**
 * How much harder each child you already have makes the next one.
 *
 * Not biology — time, money and exhaustion. Without it, a player who presses
 * the button every year from twenty-two ends up with fourteen children, which
 * measuring the first version confirmed.
 */
/**
 * A year after a birth before the player can try again.
 *
 * Not squeamishness — pacing, and it was found by reading output. The gestation
 * year does NOT slow anything down on its own, because the family phase runs
 * before the player acts: a baby born in the spring clears the pregnancy, and
 * the same year's Try For A Baby is available immediately. Measured, that gave
 * one child a YEAR rather than one per two years, a mean family of 4.2 and 38%
 * of players with five or more — against the 3% the model was tuned for.
 */
export const RECOVERY_YEARS = 1;

export const CROWDING = 0.35;

/** Never quite zero while the curve is open. A big family is rare, not barred. */
export const CROWDING_FLOOR = 0.04;

export function conceptionChance(age: number, childrenAlready: number): number {
  const base = fertility(age);
  if (base === 0) return 0;
  // MULTIPLICATIVE, not a capped subtraction. The first version subtracted and
  // capped at 0.88, which meant crowding stopped mattering after three children
  // — a fourth and a twentieth were exactly as likely, which is the opposite of
  // what the term is for. A test caught it by asserting the sixth was harder
  // than the third and finding them identical.
  return Math.max(CROWDING_FLOOR, base * Math.pow(1 - CROWDING, childrenAlready));
}

/**
 * The measurement these numbers were set from, kept beside them per
 * CORE_RULES 13.7. 20,000 lives per row, with a year of gestation:
 *
 *   pressing every year from 22 → 3.8 children (2-5, 6+ in 3%)
 *   pressing every year from 30 → 2.7 children (mostly 2-3)
 *   pressing every year from 34 → 2.0 children, 1% with none
 *   pressing every year from 38 → 1.2 children, 12% with none
 *   trying for four years at 28 → about 10% came away with none
 *   trying for four years at 38 → about 28% came away with none
 *
 * Two shapes matter. Family size clusters where families actually cluster, and
 * a six-child family is rare rather than impossible. And leaving it late costs
 * the player something real without ever making it hopeless.
 */

/** Where a pregnancy has got to. Absent means there isn't one. */
export interface Pregnancy {
  /** The player's age when it started. */
  readonly since: number;
  /** The other parent, as their id in the social circle. Absent if single. */
  readonly otherParentId?: string;
}

export const isDue = (pregnancy: Pregnancy, age: number): boolean =>
  age - pregnancy.since >= GESTATION_YEARS;

/* -------------------------------------------------------------------------- */
/* What a child costs                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Spec 175: "open a child to see that child's monthly cost." Contextual, never
 * a line in an expense breakdown — spec 170 rules that out explicitly.
 *
 * There is no ledger until Ticket 0301, so this is what the number will be
 * when there is one, and what the child's page shows now. It rises with the
 * child's age because a teenager costs more than a toddler, which every parent
 * knows and no game ever says.
 */
export const BASE_CHILD_COST = 42_000; // cents a month

export function monthlyCostOf(childAge: number): Money {
  const teen = childAge >= 13 ? 1.55 : childAge >= 5 ? 1.2 : 1;
  return dollars(Math.round((BASE_CHILD_COST * teen) / 100));
}

export const yearlyCostOf = (childAge: number): Money =>
  dollars(Math.round((Number(monthlyCostOf(childAge)) * 12) / 100));

/* -------------------------------------------------------------------------- */
/* How a child is doing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A child's relationship with the player moves every year on its own, and the
 * direction is set by whether the player has been around.
 *
 * This is the whole of what "parenting" is in this game, and it is deliberately
 * the same shape as the friendship model: showing up is most of it. A parent
 * who answers what their child asks stays close to them; one who never does
 * drifts, slowly, in a way nobody announces until it has happened.
 */
export const CLOSENESS_DRIFT = 5;

/** Below this, a teenager has stopped telling you things. */
export const DISTANT = 45;

/**
 * What the player did about this child this year.
 *
 * THREE states, not two, and the third one is the fix for a defect measuring
 * found. The first version asked only "did you answer them", so a parent of
 * four who said yes to every single thing any of them asked still watched every
 * child drift — because asks arrive about once a year across the whole family,
 * so each individual child goes unanswered three years in four. Measured, a
 * player doing everything the game offered ended at a mean closeness of 51 and
 * falling.
 *
 * That was the model calling "nobody asked you for anything" neglect. A parent
 * who had no opportunity did not miss one. So a year with no ask drifts gently
 * back towards the middle rather than down, and only a REFUSAL costs.
 */
export type ParentYear = 'answered' | 'refused' | 'nothing-asked';

/**
 * A child's relationship with the player moves every year on its own.
 *
 * This is the whole of what "parenting" is in this game, and it is deliberately
 * the same shape as the friendship model: showing up is most of it. What is
 * different is that a child cannot drift out of your life, so this settles
 * rather than ending.
 */
export const SETTLES_AT = 62;

export function closenessYear(warmth: number, year: ParentYear, childAge: number): StatValue {
  // Teenagers pull away regardless. That is not a failure of parenting and the
  // model should not punish the player for it as though it were.
  const teenPull = childAge >= 13 && childAge <= 17 ? -3 : 0;

  if (year === 'nothing-asked') {
    // Towards the middle, from either side. An ordinary year with a child you
    // are close to costs you a little; one with a child you are not brings them
    // back a little. Spec 1986: most of raising them is abstracted.
    const towards = (SETTLES_AT - warmth) * 0.12;
    return clampStat(Math.round(warmth + towards + teenPull));
  }

  const attention = year === 'answered' ? CLOSENESS_DRIFT : -CLOSENESS_DRIFT * 1.2;
  return clampStat(Math.round(warmth + attention + teenPull));
}

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The line the feed writes when a child turns this age.
 *
 * At most ONE a year per child, and only at the ages that genuinely are
 * something. Reading 0206's output found the feed drowning in small lines, and
 * a family of three children could produce three a year forever if every
 * birthday earned one.
 */
const MILESTONES: Readonly<Record<number, readonly string[]>> = {
  0: ['{name} was born. Everything else got smaller for a while.'],
  1: [
    '{name} took a first step, into a table.',
    "{name} said a first word. It wasn't either of your names.",
  ],
  3: ["{name} started asking why, and didn't stop."],
  5: ["{name} started kindergarten and didn't look back once."],
  8: ['{name} got obsessed with one thing and talked about nothing else all year.'],
  11: ['{name} started middle school and came home quieter.'],
  13: ['{name} turned thirteen and started closing the bedroom door.'],
  16: ['{name} got a first job and spent all of it in a week.'],
  18: ['{name} turned eighteen. Legally, that is the end of your part in it.'],
};

export function milestoneFor(childAge: number, name: string, roll: number): string | undefined {
  const lines = MILESTONES[childAge];
  if (!lines || lines.length === 0) return undefined;
  const index = Math.min(lines.length - 1, Math.floor(roll * lines.length));
  return (lines[index] as string).replace(/\{name\}/g, name);
}

/* -------------------------------------------------------------------------- */
/* What a child asks for                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Spec 61, verbatim: "Children should instead ask for activities, e.g.
 * basketball or Muay Thai lessons. If the player approves, the child joins."
 * Spec 1147 lists "approve/deny a child's requested activity" as an example of
 * a GOOD visible decision.
 *
 * So this is the one thing the player does as a parent, and it is a real
 * decision rather than a formality: it costs money, saying yes is not always
 * right, and saying no is not always wrong.
 */
export interface ChildAsk {
  readonly id: string;
  /** What the child says they want, rendered into the prompt. */
  readonly wants: string;
  /** In cents, for the year. */
  readonly cost: number;
  readonly minAge: number;
  readonly maxAge: number;
  /** What it does for them if the player says yes. */
  readonly gives: 'body' | 'mind' | 'people' | 'spark';
}

export const CHILD_ASKS: readonly ChildAsk[] = [
  {
    id: 'basketball',
    wants: 'to play basketball',
    cost: 22_000,
    minAge: 6,
    maxAge: 17,
    gives: 'body',
  },
  {
    id: 'martial-arts',
    wants: 'to take martial arts lessons',
    cost: 34_000,
    minAge: 5,
    maxAge: 17,
    gives: 'body',
  },
  {
    id: 'swimming',
    wants: 'to join the swim team',
    cost: 28_000,
    minAge: 5,
    maxAge: 17,
    gives: 'body',
  },
  { id: 'piano', wants: 'to learn piano', cost: 40_000, minAge: 5, maxAge: 17, gives: 'spark' },
  { id: 'art', wants: 'to take an art class', cost: 18_000, minAge: 5, maxAge: 17, gives: 'spark' },
  {
    id: 'drama',
    wants: 'to be in the school play',
    cost: 9_000,
    minAge: 7,
    maxAge: 17,
    gives: 'people',
  },
  {
    id: 'coding',
    wants: 'a computer for making things',
    cost: 65_000,
    minAge: 9,
    maxAge: 17,
    gives: 'mind',
  },
  {
    id: 'tutor',
    wants: 'a tutor for the subject they are failing',
    cost: 55_000,
    minAge: 8,
    maxAge: 17,
    gives: 'mind',
  },
  {
    id: 'camp',
    wants: 'to go to summer camp',
    cost: 48_000,
    minAge: 7,
    maxAge: 16,
    gives: 'people',
  },
  {
    id: 'dog',
    wants: 'a dog, and promises to walk it',
    cost: 30_000,
    minAge: 5,
    maxAge: 14,
    gives: 'people',
  },
  {
    id: 'phone',
    wants: 'a phone, because everyone else has one',
    cost: 25_000,
    minAge: 11,
    maxAge: 17,
    gives: 'people',
  },
  {
    id: 'trip',
    wants: 'to go on the school trip',
    cost: 52_000,
    minAge: 10,
    maxAge: 17,
    gives: 'mind',
  },
];

export const asksFor = (childAge: number): readonly ChildAsk[] =>
  CHILD_ASKS.filter((ask) => childAge >= ask.minAge && childAge <= ask.maxAge);

/**
 * What saying yes actually costs this parent.
 *
 * CORE_RULES 13.16, and this is the SECOND time the rule has been earned the
 * hard way. Ticket 0207 priced a wedding at $9,000 in a build whose median
 * thirty-year-old holds thirteen dollars, and 0% of lives ever married. This
 * ticket then priced a school play at $90 and a computer at $650, and reading
 * 90 played families found children asking for things 702 times and the parent
 * able to say yes ZERO times. The one parenting decision spec 61 asks for was
 * unreachable, and every family in the game ended estranged as a result,
 * because `closenessYear` drains when nobody ever answers.
 *
 * The listed price is what the thing costs. What the parent pays is what they
 * can put towards it — you scrape it together for your kid, which is both what
 * people do and the only version of this that works before Ticket 0210 gives
 * anybody an income. When income ships, most parents will simply pay the listed
 * price and the cap stops mattering, with nothing to retune.
 */
export const askCost = (listed: number, cash: number): number =>
  Math.max(0, Math.min(listed, cash));

/**
 * Whether a child asks for anything this year at all.
 *
 * Not every year, because a child who asks for something every single year for
 * twelve years is a subscription rather than a person, and spec 1986 abstracts
 * the ordinary business of raising one.
 */
export const ASK_CHANCE = 0.45;

/* -------------------------------------------------------------------------- */
/* Roster helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Children still living at home. Eighteen is the line (spec 61's kick-out). */
export const childrenAtHome = (household: Household, worldYear: number): FamilyMember[] =>
  livingChildren(household).filter((child) => worldYear - child.birthYear < PARENT_AGE);

export const adultChildren = (household: Household, worldYear: number): FamilyMember[] =>
  livingChildren(household).filter((child) => worldYear - child.birthYear >= PARENT_AGE);

/** What a newborn inherits. Half from each parent, plus who they turn out to be. */
export function childPersonality(
  mine: Personality,
  theirs: Personality | undefined,
  draw: (key: string) => number,
): Personality {
  const keys = Object.keys(mine) as (keyof Personality)[];
  const result = {} as Record<keyof Personality, StatValue>;
  for (const key of keys) {
    const inherited = theirs ? (mine[key] + theirs[key]) / 2 : mine[key];
    // Deliberately wide. Children are not averages of their parents, and a
    // model that made them one would produce a dynasty of near-identical people.
    const ownSelf = (draw(String(key)) - 0.5) * 60;
    result[key] = clampStat(Math.round(inherited + ownSelf));
  }
  return result as Personality;
}

export type { Sex };
