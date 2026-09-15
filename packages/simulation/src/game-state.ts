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
  EMPTY_LOANS,
  EMPTY_PORTFOLIO,
  NEW_HOUSEHOLD,
  NO_RETIREMENT,
  OPENING_MARKET,
  openingPrices,
  type HeldCard,
  type HeldLoan,
  type Holding,
  type HouseholdFinances,
  type Ledger,
  type MarketState,
  type PriceBook,
  type RetirementState,
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
   * Ticket 0307: what has been borrowed and what is left of it.
   *
   * Separate from `cards` because the instruments genuinely differ — a loan is
   * drawn once and amortises, a card revolves — and because spec 1857 treats
   * them as different things a lender offers. What they share is the category
   * they post to: everything owed is `debt` in the ledger.
   */
  readonly loans: readonly HeldLoan[];
  /**
   * Ticket 0308: the portfolio, and the market it sits in.
   *
   * `market` is beside the holdings rather than inside `world` on purpose. Spec
   * 706-724 wants a backend economy influencing employment, property, business
   * AND investments, and that economy is unticketed — when it lands it owns a
   * broader state than this and will move this field up to the world. Putting
   * it in `world` NOW would be claiming a scope this ticket does not have and
   * inviting the employment phase to start reading it (CORE_RULES 13.36: a
   * field nothing writes is a promise, and a field the wrong thing writes is
   * worse).
   */
  readonly portfolio: readonly Holding[];
  readonly market: MarketState;
  /**
   * Ticket 0308c. Every instrument's price history, oldest first.
   *
   * Beside the portfolio rather than inside it, because prices exist whether or
   * not this character owns anything — the market list shows all eighty-nine
   * with or without a holding, and a price book that only tracked what somebody
   * held would have nothing to draw a chart from the moment they sold.
   */
  readonly prices: PriceBook;
  /**
   * Ticket 0309. Who the character pays for investment advice, if anybody.
   *
   * An ID rather than an object, because an advisor is content and a save that
   * inlined one would freeze the fee and the risk bars at whatever they were
   * the day it was written — the same defect the v23 migration hit when it
   * froze a price table instead of reading the live catalog.
   *
   * ABSENT IS THE NORMAL STATE. Most characters never hire anybody, and a
   * migration that assigned one would be inventing a decision (and a fee) that
   * nobody made.
   */
  readonly advisorId?: string;
  /**
   * Ticket 0310. The retirement account, the pension service, and whether they
   * have stopped.
   *
   * Beside the portfolio rather than inside it, and NOT as a holding, because
   * the whole point of the account is that the player cannot sell it on a
   * whim — a holding in `portfolio` would show up on the Investments screen
   * with a Sell button and the lock would be decoration. Spec 163 still gets
   * what it asks for: `estateOf` folds the balance into the net-worth line, so
   * it rolls into Assets without ever being its own row.
   */
  readonly retirement: RetirementState;
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
  readonly loans?: readonly HeldLoan[];
  readonly portfolio?: readonly Holding[];
  readonly market?: MarketState;
  readonly prices?: PriceBook;
  readonly family?: Household;
  readonly nameCultureId?: string;
  readonly events?: EventHistory;
  readonly education?: EducationState;
  readonly circle?: SocialCircle;
  readonly parenting?: ParentingState;
  readonly employment?: EmploymentState;
  readonly retirement?: RetirementState;
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
  loans: options.loans ?? EMPTY_LOANS,
  portfolio: options.portfolio ?? EMPTY_PORTFOLIO,
  market: options.market ?? OPENING_MARKET,
  prices: options.prices ?? openingPrices(),
  retirement: options.retirement ?? NO_RETIREMENT,
  pending: options.pending ?? [],
  rng,
});
