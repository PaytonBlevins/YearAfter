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
import { EMPTY_PARENTING, type ParentingState } from '@yearafter/parenting';
import { EMPTY_EMPLOYMENT, type EmploymentState } from '@yearafter/careers';
import { EMPTY_HEALTH, type HealthState } from '@yearafter/health';
import {
  EMPTY_CARDS,
  EMPTY_LEDGER,
  NEW_HOUSEHOLD,
  type HeldCard,
  type HouseholdFinances,
  type Ledger,
} from '@yearafter/finance';
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
   * Ticket 0208: a pregnancy, an open adoption, and what a child has asked for.
   *
   * The CHILDREN themselves live in `family`, because they are household
   * members like a sibling is. This is the part that is happening this year
   * rather than the part that is true about the family.
   */
  readonly parenting: ParentingState;
  /**
   * Ticket 0210: the job, what it pays, and standing in every field ever
   * worked in.
   *
   * Beside the player rather than on them, like education and family, for the
   * same reason: on dynasty continuation the player is replaced and a career
   * does not carry over.
   */
  readonly employment: EmploymentState;
  /**
   * Ticket 0211: what is wrong with them, and whether a doctor is on it.
   *
   * The health STAT stays on the character with the other six, because the
   * player has been looking at that bar since 0106. This is the part the bar
   * cannot say: which conditions are held, since when, and whether the year's
   * check-up has been used. Beside the player for the same reason as education
   * and employment — on dynasty continuation the player is replaced and a body
   * does not carry over.
   */
  readonly health: HealthState;
  /**
   * Ticket 0301: every movement of money, and the balance they add up to.
   *
   * `player.cash` is still where the UI reads the number from, and it is now a
   * MIRROR of `finance.balance` rather than a value anybody computes. Exactly
   * one function may move money — `post` in `@yearafter/finance` — and every
   * writer of `cash` sets it from `cashFrom(finance)`.
   *
   * Beside the player rather than on them, like education, employment and
   * health, and for the same reason: on dynasty continuation the player is
   * replaced, and a ledger belongs to whoever earned it.
   */
  readonly finance: Ledger;
  /**
   * Ticket 0303: the standard of living, and whether they pay for a roof.
   *
   * Two fields, and both had to exist for living costs to be anything other
   * than a percentage of a wage. `standard` is what this character is used to
   * spending, and it has MEMORY — it climbs quickly with income and falls back
   * slowly, which is the whole reason losing a job costs something here.
   * `housing` is the one bit of housing circumstance the build can honestly
   * support until v0.05 brings property.
   *
   * Beside the player rather than on them, like the ledger and for the same
   * reason: an heir starts their own life at their own standard.
   */
  readonly household: HouseholdFinances;
  /**
   * Ticket 0306: the cards a character holds, and what is on them.
   *
   * Beside the ledger rather than inside it, because a ledger is a record of
   * what happened and a card is a thing you have. Spec 28 is emphatic about
   * what is NOT stored on one: no opened date and no payment-history timeline.
   *
   * Replaced on dynasty continuation, like everything else about a life. An
   * heir does not inherit a balance, which is also the honest answer until
   * v0.05 gives an estate something to settle debts against.
   */
  readonly cards: readonly HeldCard[];
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
  readonly health?: HealthState;
  readonly finance?: Ledger;
  readonly household?: HouseholdFinances;
  readonly cards?: readonly HeldCard[];
  readonly family?: Household;
  readonly nameCultureId?: string;
  readonly events?: EventHistory;
  readonly education?: EducationState;
  readonly circle?: SocialCircle;
  readonly parenting?: ParentingState;
  readonly employment?: EmploymentState;
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
  parenting: options.parenting ?? EMPTY_PARENTING,
  employment: options.employment ?? EMPTY_EMPLOYMENT,
  health: options.health ?? EMPTY_HEALTH,
  finance: options.finance ?? EMPTY_LEDGER,
  household: options.household ?? NEW_HOUSEHOLD,
  cards: options.cards ?? EMPTY_CARDS,
  pending: options.pending ?? [],
  rng,
});
