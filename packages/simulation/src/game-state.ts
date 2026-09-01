/**
 * The live game state and the year-advance loop.
 *
 * PROTECTED CONTRACT (spec 1060–1066): time advancement.
 *
 * `GameState` is the in-memory shape the simulation operates on. The save file
 * is a serialised projection of it (@yearafter/persistence). Keeping the two
 * separate is what stops save concerns from leaking into game logic.
 */

import type { Character } from '@yearafter/character';
import { NOT_YET_ENROLLED, type EducationState } from '@yearafter/education';
import { EMPTY_HISTORY, type EventHistory, type PendingDecision } from '@yearafter/events';
import { EMPTY_HOUSEHOLD, type Household } from '@yearafter/relationships';
import { EMPTY_CIRCLE, type SocialCircle } from '@yearafter/social';
import { Rng } from './rng/rng';

/** World state that outlives any single character (spec 818–827 continuation). */
export interface WorldState {
  /** In-world calendar year. */
  readonly year: number;
  /** Increments each time the player continues as a descendant. */
  readonly generation: number;
}

export interface GameState {
  readonly world: WorldState;
  readonly player: Character;
  /**
   * The player's family (Ticket 0202). Kept beside the player rather than on
   * them: on dynasty continuation (spec 818–827) the player is replaced and the
   * family is rebuilt, so it is not part of a character's own record.
   */
  readonly family: Household;
  /**
   * The naming tradition this life was generated from (Ticket 0201).
   *
   * Stored rather than re-derived: a city lists several traditions with weights,
   * so recovering the one that was actually drawn is not possible from the city
   * alone, and guessing would give a character's incidental acquaintances names
   * from a culture their own family does not use.
   */
  readonly nameCultureId: string;
  /** What the event engine remembers: cooldowns, chains and story flags (0203). */
  readonly events: EventHistory;
  /**
   * Schooling (Ticket 0204): enrolment, grades, behaviour and what they joined.
   *
   * Beside the player rather than on them, for the same reason the family is —
   * on dynasty continuation the player is replaced and this starts again.
   */
  readonly education: EducationState;
  /**
   * The people who are not family (Ticket 0206): classmates, friends, teachers.
   *
   * Held beside `family` rather than inside it, because the two have genuinely
   * different rules — you cannot drift out of being somebody's brother, and the
   * Relationships screen shows them as two lists (spec 839–848).
   */
  readonly circle: SocialCircle;
  /**
   * Decisions waiting on the player.
   *
   * Held in state rather than in the UI because a decision must survive a save,
   * a reload and a cold app start. Time does not advance while this is non-empty
   * (CORE_RULES: advancing is one control, and a pending question is not it).
   */
  readonly pending: readonly PendingDecision[];
  /** Live RNG registry. Serialised into the save on every write. */
  readonly rng: Rng;
}

export const createWorldState = (year: number, generation = 1): WorldState => ({
  year,
  generation,
});

export interface CreateGameStateOptions {
  readonly family?: Household;
  readonly nameCultureId?: string;
  readonly events?: EventHistory;
  readonly education?: EducationState;
  readonly circle?: SocialCircle;
  readonly pending?: readonly PendingDecision[];
}

export const createGameState = (
  world: WorldState,
  player: Character,
  rng: Rng,
  options: CreateGameStateOptions = {},
): GameState => ({
  world,
  player,
  family: options.family ?? EMPTY_HOUSEHOLD,
  nameCultureId: options.nameCultureId ?? 'us-en',
  events: options.events ?? EMPTY_HISTORY,
  education: options.education ?? NOT_YET_ENROLLED,
  circle: options.circle ?? EMPTY_CIRCLE,
  pending: options.pending ?? [],
  rng,
});
