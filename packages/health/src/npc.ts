/**
 * Ticket 0212 — everybody else's body.
 *
 * 0211 gave the PLAYER a body that ages and a life that ends. Nothing else in
 * the game got one, and the measurement that opened 0212 says what that cost:
 * across 400 played lives the player died at a median of seventy-three, and the
 * median SURVIVING PARENT was **one hundred and five years old**. The oldest
 * was a hundred and thirty-five. `alive: false` on a family member had been
 * read by the stress model since 0205 and written by nothing, ever — the exact
 * shape of 0210's `droppedOut`, which was read in five places and written in
 * zero.
 *
 * Spec 818–827 asks the death screen for "family survived by". That phrase is
 * fiction in a world where nobody dies.
 *
 * WHY THIS IS NOT JUST `deathChance` WITH A GUESS
 *
 * An NPC has no vitality, no deficit and no conditions — 0211's model is a
 * year-by-year accumulation and NPCs are not simulated year by year in that
 * detail, nor should they be: five classmates, two parents, three colleagues
 * and a partner, each carrying a condition list, is a save that grows forever
 * for a screen that shows one word.
 *
 * So an NPC's health is DERIVED from two things: their age, and a constitution
 * that is stable for their whole life. The age curve is 0211's own — the same
 * constants, integrated in closed form rather than accumulated — so an NPC and
 * the player age by the same rule and a future ticket that tunes one tunes both.
 *
 * The constitution comes from `stableUnit(id)`, which means it costs no RNG
 * state, never needs storing, and is the same on every load. Two seventy-year
 * olds are not equally likely to see seventy-one, and no save got bigger.
 */

import { stablePick } from '@yearafter/core';
import { DECLINE_ACCELERATES, DECLINE_STARTS, FAST_DECLINE_PER_YEAR, SLOW_DECLINE } from './aging';
import { deathChance } from './health';

/**
 * The health an NPC peaks at, by constitution.
 *
 * Swept rather than guessed. At [58, 84] — the first, cautious range — the
 * spread in life expectancy across a thousand constitutions was **4.9 years**,
 * which is another way of saying constitution did not exist: every NPC in the
 * world died at eighty give or take a rounding error, and "she was always
 * strong" would have been a sentence the game could not mean. Widening to this
 * puts the p10-to-p90 span at about eleven years, which is a difference a
 * player can notice across a family.
 */
export const NPC_PEAK_HEALTH: readonly [number, number] = [40, 98];

/**
 * What an NPC's unsimulated illnesses do to their odds.
 *
 * Without this the model is dishonest in a specific, measurable way: the PLAYER
 * collects conditions and each one multiplies their hazard, so a played life
 * ends at a median of seventy-three — while an NPC on the same age curve with
 * an empty condition list lands at eighty. Every character in the game would
 * systematically die before the people around them, and outliving somebody —
 * which is most of what a long life feels like — would barely happen.
 *
 * So this stands in for the conditions an NPC would have collected if we
 * simulated them, as a hazard multiplier that grows with age. It is a
 * deliberate approximation, and it is labelled as one: the alternative is a
 * condition list per person per year for a screen that prints one word.
 *
 * Swept against the played population. At no morbidity NPCs reach a median 80;
 * this lands them at 76 — a little past a passive player and a little short of
 * one who sees a doctor, which is where the neighbours of a played life belong.
 */
export const NPC_MORBIDITY_FROM = 40;
export const NPC_MORBIDITY_SCALE = 35;

export function npcMorbidity(age: number): number {
  if (age <= NPC_MORBIDITY_FROM) return 1;
  const past = age - NPC_MORBIDITY_FROM;
  return 1 + (past / NPC_MORBIDITY_SCALE) ** 2;
}

/**
 * How much of the peak a body has lost by this age.
 *
 * The closed form of `ageingLoss` summed from `DECLINE_STARTS`. Written as a
 * formula rather than a loop because it is called for every person the player
 * knows, every year, for eighty years — and because the two shapes must not be
 * able to disagree, the test asserts this against an actual accumulation of
 * `ageingLoss` rather than against remembered numbers.
 */
export function cumulativeAgeingLoss(age: number): number {
  if (age <= DECLINE_STARTS) return 0;
  // The sum is over the years LIVED THROUGH, ages DECLINE_STARTS..age-1, which
  // is the off-by-one the accumulation test caught immediately: `ageingLoss`
  // charges at DECLINE_ACCELERATES itself with a `past` of zero, so that year
  // belongs to the fast arm at k=0 and not to the slow one.
  const slowYears = Math.max(0, Math.min(age, DECLINE_ACCELERATES) - DECLINE_STARTS);
  let loss = slowYears * SLOW_DECLINE;
  if (age > DECLINE_ACCELERATES) {
    const past = age - DECLINE_ACCELERATES;
    loss += past * SLOW_DECLINE + (FAST_DECLINE_PER_YEAR * past * (past - 1)) / 2;
  }
  return loss;
}

/** An NPC's peak health, from a stable [0,1) draw on their id. */
export function npcPeakHealth(constitution: number): number {
  const [low, high] = NPC_PEAK_HEALTH;
  return low + constitution * (high - low);
}

/** What this person's body is like right now. Never stored; always derived. */
export function npcHealthAt(constitution: number, age: number): number {
  return Math.max(1, npcPeakHealth(constitution) - cumulativeAgeingLoss(age));
}

/**
 * The chance this person does not see next year.
 *
 * Goes through the SAME `deathChance` the player does, with an empty condition
 * list. That is the point: an NPC is not on a second mortality curve that can
 * drift away from the player's. If a later ticket makes eighty-year-olds live
 * longer, it moves one set of constants and everybody in the world moves.
 *
 * Children are exempt below `CHILD_SAFE_UNTIL`. This is a game about a life,
 * and a game that kills the player's six-year-old at random — with no story, no
 * warning and nothing the player could have done — is not a game anybody
 * wants to have opened on a bus. Spec 559's "almost never" for the player is
 * a floor here, not a ceiling.
 */
export const CHILD_SAFE_UNTIL = 18;

export function npcDeathChance(constitution: number, age: number): number {
  if (age < CHILD_SAFE_UNTIL) return 0;
  const base = deathChance({ age, health: npcHealthAt(constitution, age), conditions: [] });
  return Math.min(0.97, base * npcMorbidity(age));
}

/**
 * What it says on their certificate.
 *
 * Deliberately vaguer than the player's list. The player's cause comes from
 * conditions they collected and watched happen; an NPC's is the phrase somebody
 * would actually use about a person they knew, and inventing a specific
 * diagnosis for an illness that was never simulated would be the game asserting
 * a fact it does not have.
 *
 * FOUR causes was one, in practice. The first version returned a single string
 * per age band, and because most deaths land past sixty-two, reading a played
 * life showed **six of eight** death notices saying "of a long illness" — the
 * same sentence about six different people. CORE_RULES 13.17, for the eighth
 * time: repeatable copy needs more lines than repeats, and a stable index.
 *
 * The index is the person's own id, so it never changes, never consumes RNG,
 * and the same character is remembered the same way on every load.
 */
const CAUSES: readonly (readonly [number, readonly string[]])[] = [
  /*
    Every entry in every band has to be a NOUN PHRASE that survives being
    dropped into any of the four sentence shapes in the kin phase. The first
    version had "old age, in the end", which reads fine alone and produced
    "Mom died, of old age, in the end. Ruth was 84." A copy table whose entries
    only work in the template their author had open is a table that breaks the
    next time somebody adds a template.
  */
  [82, ['old age', 'a stroke', 'pneumonia', 'a fall', 'a long illness']],
  [
    62,
    [
      'a long illness',
      'something that had been coming for a while',
      'a heart that gave out',
      'a stroke',
      'cancer',
      'an illness nobody caught in time',
    ],
  ],
  [
    40,
    ['an illness', 'a heart attack', 'something sudden', 'cancer', 'an illness, very fast'],
  ],
  [0, ['an accident', 'a car accident', 'something nobody expected']],
];

export function npcCauseOf(age: number, key = ''): string {
  const band = CAUSES.find(([from]) => age >= from)?.[1] ?? ['an illness'];
  // NOT "their health", which the first version used for the 40–61 band and
  // which reading a played life caught at once: "Mom died, of their health."
  // A relation word and a possessive pronoun are not interchangeable — 0211c's
  // sibling defect in a new place, and the fix is the same one: do not need a
  // pronoun at all.
  return stablePick(band, `cause:${key}`) as string;
}
