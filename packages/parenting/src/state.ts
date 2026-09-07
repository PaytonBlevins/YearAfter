/**
 * Ticket 0208 — the parenting slice of game state.
 *
 * Beside the household rather than inside it, for the same reason education and
 * the social circle are beside the player: a pregnancy and an open adoption
 * application are things happening TO the character this year, not facts about
 * who is in the family. When a dynasty continues, the family carries over and
 * this does not.
 */

import type { AdoptionApplication } from './adoption';
import type { Pregnancy } from './parenting';

/** What a child asked for this year, and whether it has been answered. */
export interface OpenAsk {
  readonly childId: string;
  readonly askId: string;
  /** The player's age when it was asked. A new year clears it. */
  readonly age: number;
}

export interface ParentingState {
  readonly pregnancy?: Pregnancy;
  readonly adoption?: AdoptionApplication;
  /**
   * Whatever a child has asked for and not had an answer to.
   *
   * At most one open at a time. A queue of four children each wanting
   * something would be a to-do list, and spec 1813 says player-parent
   * interaction stays lightweight.
   */
  readonly ask?: OpenAsk;
  /** The player's age when they last tried for a baby. Once a year. */
  readonly triedAtAge?: number;
  /** The player's age at the last birth. See `RECOVERY_YEARS`. */
  readonly lastBirthAtAge?: number;
  /** Ticket 0209: what the player has asked each of their own parents for. */
  readonly askedParents?: AskedParents;
  /**
   * Requests that have already been GRANTED, by id and the age it happened.
   *
   * Separate from `askedParents` because being told no and being given the
   * thing are different facts: you can ask again after a no, and you do not ask
   * again after a yes.
   */
  readonly granted?: Readonly<Record<string, number>>;
  /** Per child, the player's age when they last said yes to something. */
  readonly answered: Readonly<Record<string, number>>;
  /** Per child, the player's age when they last said no. */
  readonly refused?: Readonly<Record<string, number>>;
  /**
   * Per child, the things they have already asked for.
   *
   * Reading 90 played families found the same child asking to join the swim
   * team at 28 and again at 32, and another asking for a dog twice. A child who
   * asks for the thing they already have — or the thing you already turned down
   * once — reads as the game forgetting, which is the same defect as repeated
   * copy (0207d) wearing a different hat.
   */
  readonly askedBefore?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Ticket 0209. What the player has already asked each parent for this year.
 *
 * Keyed by parent id, then request id, holding the age it was asked. Heavy
 * requests are once a year PER PARENT — asking your mother for a car in March
 * and your father in April is a thing children do and the model allows it;
 * asking the same parent twice is not.
 */
export type AskedParents = Readonly<Record<string, Readonly<Record<string, number>>>>;

export const EMPTY_PARENTING: ParentingState = { answered: {}, askedParents: {} };

/**
 * Whether the player has already used this year's attempt.
 *
 * The year of a birth counts as used. Without that the family phase, which runs
 * before the player acts, clears the pregnancy and hands the button straight
 * back — measured at one child a year rather than one per two.
 */
export const triedThisYear = (state: ParentingState, age: number): boolean =>
  state.triedAtAge === age || state.lastBirthAtAge === age;

/** Whether the player has already put this to this parent this year. */
export const alreadyAskedParent = (
  state: ParentingState,
  parentId: string,
  requestId: string,
  age: number,
): boolean => (state.askedParents?.[parentId]?.[requestId] ?? -99) === age;

/** Whether the player has already been given this, ever. */
export const alreadyGranted = (state: ParentingState, requestId: string): boolean =>
  state.granted?.[requestId] !== undefined;

/** What this child has already asked for, so they never ask twice. */
export const alreadyAsked = (state: ParentingState, childId: string): readonly string[] =>
  state.askedBefore?.[childId] ?? [];

/** What the player did about this child in the year just gone. */
export const parentYearFor = (
  state: ParentingState,
  childId: string,
  age: number,
): 'answered' | 'refused' | 'nothing-asked' => {
  if ((state.answered[childId] ?? -99) >= age - 1) return 'answered';
  if ((state.refused?.[childId] ?? -99) >= age - 1) return 'refused';
  return 'nothing-asked';
};
