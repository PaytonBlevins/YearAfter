/**
 * Ticket 0412 — the friendship nobody pressed a button about.
 *
 * `interact.ts` is the verb, and it is only ever called by a tap. So a
 * relationship in this build was kept alive by exactly two things: being in a
 * room with somebody, and the player opening a screen. Nothing else. Measured
 * across 90 played lives with a player who answers every question and never
 * opens a screen:
 *
 * | age | share of lives with NO platonic friend | closest friend, median |
 * |---|---|---|
 * | 14 | **84.4%** | 44 |
 * | 17 | 11.1% | 56 |
 * | 19 | **88.9%** | 44 |
 * | 20 | **87.8%** | 42 |
 * | 22 | 37.8% | 51 |
 * | 25 | 11.1% | 67 |
 *
 * A sawtooth, and the roadmap had only noticed one of its teeth (finding 2b,
 * *"a trough at twenty"*). The cause is not adulthood: a friendship here is a
 * function of how long the CURRENT ROOM has been open, every change of room
 * resets the cast to strangers at 26–46 warmth, and it takes three or four
 * years of proximity to cross the friendship line at 50. School stages are four
 * to six years long, so the class barely gets there before it is emptied —
 * elementary to middle at eleven, middle to high at fourteen, high to college or
 * work at eighteen. Fourteen and nineteen are the same hole, two rooms apart.
 *
 * WHAT IS MISSING IS NOT A WAY TO RAISE WARMTH. Proximity already hands out
 * plenty — 0412 had to put a curve on it precisely because it handed out too
 * much (see `curvedWarmth`). What is missing is anything at all that holds a
 * friendship together OUTSIDE a room, which is the only place a friendship is
 * ever actually decided.
 *
 * So: once a year, without being asked, you keep up with one person you are no
 * longer in a room with. It is the systemic side of `interact.ts` exactly as
 * 0410 was the systemic side of `romance.ts`, and it follows 0410's rule — it
 * runs the REAL verb. `resolveInteraction`, the same odds, the same copy, the
 * same memory on the same page, the same ability to go badly.
 *
 * Three things keep it from being a machine for immortal friendships:
 *
 *  1. **One person a year.** A character with four people out of the room keeps
 *     up with one and loses three. That is the honest model of leaving school,
 *     and it is what stops this re-freezing the cast that 0207b had to unfreeze.
 *  2. **It is worth less than a tap** (`UNCHOSEN`). `bondFromOutcome` already
 *     states the principle for events: *"a thing that happened TO you is worth
 *     less than a thing you chose to do."* A player who works the People screen
 *     should still get further than one who never opens it, or the screen is
 *     decoration.
 *  3. **Light verbs only.** You do not accidentally tell somebody your secret,
 *     and you certainly do not accidentally have it out with them. The heavy
 *     half of the menu is where the player's own judgement lives and it stays
 *     theirs.
 *
 * Pure, like the rest of this package: the caller supplies every draw.
 */

import { findInteraction, type Interaction, type InteractionId } from './interactions';
import { FRIENDSHIP_THRESHOLD, isCurrent, type Acquaintance } from './people';
import { isRomantic } from './romance';

/**
 * Below this, a year of not hearing from somebody is the truth about it.
 *
 * Set above `DRIFT_OUT_THRESHOLD` (22) rather than at it, on purpose: somebody
 * you got nowhere with still has to be able to drift all the way out, or this
 * function becomes a floor under every acquaintance the player ever made and
 * the circle stops turning over at all.
 */
export const WORTH_KEEPING = 30;

/**
 * The chance, in a year, of keeping up with one particular person.
 *
 * PER PERSON, NOT ONE SLOT A YEAR, and that started out the other way round.
 * A single warmth-weighted lottery slot was measured against both failures at
 * once and could not clear either: run before the drift step it froze the cast
 * (earliest peer still around at twenty-six had been met at eleven), and run
 * after it the trough barely moved (77.8% of twenty-year-olds still had no
 * friend against 87.8% before the ticket), because a nineteen-year-old has
 * three or four people out of the room and one slot meant three of them drifted
 * every year regardless of who they were.
 *
 * One lottery is also the wrong shape for the thing being modelled. Whether you
 * keep up with somebody is not a competition between your friends; it is a
 * fact about each friendship. So every keepable person gets their own roll, and
 * `closeness` is most of it — you ring the person who matters most nearly every
 * year and the one you got halfway with hardly ever.
 *
 * What bounds this is no longer the slot, it is the arithmetic: the step runs
 * after `driftPerson` has already charged the year, so the year is a loss that
 * keeping up partly claws back. See `UNCHOSEN`.
 */
export const KEEP_UP_CHANCE = 0.84;

/** Floor on the closeness scale, so somebody at the bottom is unlikely, not impossible. */
export const BARELY = 0.3;

/**
 * At most this many in a year, whatever the rolls say.
 *
 * Attention is finite and the feed is not free. Three is enough that nobody
 * with a real circle is being forced to choose, and it caps the draws this step
 * can take from the Relationships stream in a year.
 */
export const KEEP_UP_AT_MOST = 3;

/**
 * What an unchosen year is worth against a chosen one.
 *
 * MEASURED, not reasoned. It has to clear `driftRate` at the warmths that
 * decide a friendship and fail to clear it higher up, and those two
 * requirements set it between them:
 *
 *  - at a relationship of 50, `driftRate` charges 4.5 and a `hang-out` that
 *    lands is worth 8 × 0.75 = 6, curved to 6. Kept up, the friendship gains;
 *    missed, it loses 4.5. A friend rung most years therefore holds.
 *  - at 85 the same interaction is worth 2 after the curve against a drift of
 *    3.9, so it slides however reliably you ring. The equilibrium is about 72
 *    — **the room is what makes a best friend and keeping up makes a good
 *    one**, which is the sentence this whole number exists to be true.
 *
 * And it is still well under a tap: the player gets the full 8, four times a
 * year if they want, plus the heavy half of the menu this never touches.
 */
export const UNCHOSEN = 0.75;

/**
 * How an ordinary year with somebody you are not in a room with goes.
 *
 * The light half of the peer menu and nothing else. `ask-for-help` is in
 * because asking somebody for a hand is one of the commonest things that
 * actually happens between friends who no longer share a room.
 */
export const ORDINARY_WAYS: readonly InteractionId[] = [
  'hang-out',
  'compliment',
  'joke',
  'ask-for-help',
];

/**
 * The people a year of silence would cost something.
 *
 * Exactly the complement of the room: anybody `inRoom` is already getting
 * proximity warmth and giving them this as well would double-count the one
 * thing that was never in short supply. Romantic partners are excluded because
 * `romanceYear` is their version of this and has been since 0207 — two
 * mechanisms warming the same person is the disagreement CORE_RULES 13.19 is
 * about. Teachers are excluded because they do not drift.
 */
export function keepableWith(
  people: readonly Acquaintance[],
  age: number,
): readonly Acquaintance[] {
  return people.filter(
    (person) =>
      person.kind === 'peer' &&
      isCurrent(person) &&
      !person.inRoom &&
      !isRomantic(person) &&
      person.lastContactAge < age &&
      person.relationship >= WORTH_KEEPING,
  );
}

/**
 * The odds of keeping up with THIS person this year.
 *
 * Three things, and the order of magnitude is deliberate:
 *
 *  - **how close you are**, which is most of it. Somebody just over the floor
 *    gets `BARELY` of the base chance and somebody at the top gets all of it.
 *  - **what the player is like** — charisma and extraversion, the same two the
 *    adult meeting roll reads, so the character who meets more people is also
 *    the one who holds on to them.
 *  - **how loyal the other person is**, which is the one use
 *    `personality.loyalty` on an NPC has ever had outside romance. Half a
 *    friendship is somebody else ringing you.
 */
export function keepUpOdds(person: Acquaintance, charisma: number, extraversion: number): number {
  const span = 100 - WORTH_KEEPING;
  const closeness = Math.max(0, Math.min(1, (person.relationship - WORTH_KEEPING) / span));
  const openness = (charisma - 50) / 50 + (extraversion - 50) / 50;
  const loyalty = (person.personality.loyalty - 50) / 50;
  const chance =
    KEEP_UP_CHANCE * (BARELY + (1 - BARELY) * closeness) * (1 + openness * 0.25 + loyalty * 0.2);
  return chance < 0.04 ? 0.04 : chance > 0.95 ? 0.95 : chance;
}

/**
 * The order the year's attention goes in, closest first.
 *
 * Only matters once `KEEP_UP_AT_MOST` binds, and then it matters a lot: a
 * character with six people out of the room should spend three years of contact
 * on the three who mean something rather than on a draw.
 */
export function inOrderOfClosest(candidates: readonly Acquaintance[]): readonly Acquaintance[] {
  return [...candidates].sort((a, b) => b.relationship - a.relationship);
}

/**
 * And what the two of you did.
 *
 * Filtered by the same `minRelationship` / `maxRelationship` the menu enforces,
 * so this can never produce something the screen would not have offered — 0410's
 * rule, and the assertion its tests make.
 */
export function ordinaryWay(person: Acquaintance, roll: number): Interaction | undefined {
  const available = ORDINARY_WAYS.map(findInteraction).filter(
    (entry): entry is Interaction =>
      entry !== undefined &&
      (entry.minRelationship === undefined || person.relationship >= entry.minRelationship) &&
      (entry.maxRelationship === undefined || person.relationship <= entry.maxRelationship),
  );
  if (available.length === 0) return undefined;
  const index = Math.min(available.length - 1, Math.floor(roll * available.length));
  return available[index];
}

/** What the year was worth, after the unchosen scale. Never rounds a gain to nothing. */
export function keptUpWarmth(raw: number): number {
  if (raw === 0) return 0;
  const scaled = raw * UNCHOSEN;
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  // A year you kept up is never worth literally nothing in the direction it
  // went — the whole point is to beat `driftRate`, and a rounding floor of zero
  // would leave this doing nothing at exactly the warmths that need it least
  // and most.
  if (rounded === 0) return raw > 0 ? 1 : -1;
  return rounded;
}

/**
 * How much the feed wants to hear about this one, when several happened.
 *
 * ONE LINE A YEAR, whatever the character did and with whoever it was most
 * worth saying about. Three reasons it is one and not none and not three:
 *
 *  - it is FREE. `buildEventContext` passes the year's lines so far to the
 *    event selector as `alreadyThisYear`, and `runSocial` runs before
 *    `runEvents`, so a social line displaces a passive event rather than adding
 *    to the year (spec 725–770). One specific afternoon with a named person is
 *    a better line than one more generic passive event, which is rule 10 of the
 *    writing rules almost verbatim.
 *  - the first version said something only when it went WRONG, and that is a
 *    biased feed: the player would have read "Sat around at Dana's not talking"
 *    several times a decade and never once read that it went well.
 *  - three would eat a year's whole budget, and the memory lands on every one
 *    of their pages regardless, which is where an ordinary afternoon belongs.
 *
 * Crossing the friendship line outranks a bad afternoon, which outranks a good
 * one. Nothing here is a verdict on the year — the line is the interaction's own
 * copy, which names a person and says what happened.
 */
export function worthSaying(before: number, after: number, worked: boolean): number {
  if (before < FRIENDSHIP_THRESHOLD && after >= FRIENDSHIP_THRESHOLD) return 2;
  return worked ? 0 : 1;
}
