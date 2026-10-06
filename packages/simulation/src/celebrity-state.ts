/**
 * Ticket 0705 — what is saved about the famous people a character has met.
 *
 * A leaf file with no imports, so the game state can hold it without a cycle. The rules are in
 * `celebrity.ts`; the world they come from is derived and is never saved (see `celebrity-world.ts`).
 */

/* -------------------------------------------------------------------------- */
/* What is saved                                                               */
/* -------------------------------------------------------------------------- */

export interface CelebrityTie {
  /** The figure's id, `field:birthYear:slot`. */
  readonly id: string;
  /** Kept as they were when met, so a page can always say who this is. */
  readonly name: string;
  readonly sex: 'male' | 'female';
  readonly field: string;
  readonly birthYear: number;
  readonly metYear: number;
  readonly metAtAge: number;
  /**
   * How well you know each other, 0–100. Once the tie is an ordinary friend (`promoted`) the
   * number lives on the friend in the circle and this one is no longer read.
   */
  readonly warmth: number;
  /** The last year anything passed between you. */
  readonly lastContactYear: number;
  /** What has been done this year, so none of it repeats. */
  readonly doneYear: number;
  readonly done: readonly string[];
  /** An ordinary friend in the circle now. */
  readonly promoted?: true;
  /** The year it ended, and how. A tie that ended stays on the list as a record. */
  readonly endedYear?: number;
  readonly endedBecause?: 'lost touch' | 'died';
}

/**
 * Ticket 0707. One thing said yes to this year (a photoshoot, a commercial, a talk show, a
 * guest-star part), with what it was worth when it was agreed. The pay is settled with the
 * year's creator income so it is taxed with it; the fame and the mood are added then too.
 */
export interface FameWorkDone {
  readonly id: string;
  /** Who it was for, as the offer read. */
  readonly outlet: string;
  /** Whole dollars. */
  readonly pay: number;
  readonly fame: number;
  readonly mood: number;
}

/** What has been said yes to, and in which year, so none of it can be done twice in one. */
export interface FameWorkState {
  readonly year: number;
  readonly done: readonly FameWorkDone[];
}

export interface CelebrityState {
  readonly ties: readonly CelebrityTie[];
  /** Everybody already met as a stranger, so the same face is not a new meeting twice. */
  readonly met: readonly string[];
  /** The year a stranger was last answered. 0 for never. */
  readonly answeredYear: number;
  /** Ticket 0707. What the character has said yes to this year. */
  readonly work: FameWorkState;
}

export const EMPTY_CELEBRITIES: CelebrityState = {
  ties: [],
  met: [],
  answeredYear: 0,
  work: { year: 0, done: [] },
};
