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
  EMPTY_HOMES,
  EMPTY_VEHICLES,
  EMPTY_BUSINESSES,
  EMPTY_DEALS,
  type PrivateDeal,
  EMPTY_VALUABLES,
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
  type OwnedHome,
  type OwnedVehicle,
  type OwnedBusiness,
  type OwnedValuable,
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
  /**
   * Ticket 0402. The job somebody came and offered, if one is open.
   *
   * It rides ALONGSIDE the pending decision rather than inside it: a
   * `PendingDecision` carries strings, and `@yearafter/events` must not learn
   * what a job is to deliver one. The decision is the question; this is what
   * answering yes would actually do.
   */
  readonly offer?: JobOffer;
  /**
   * Ticket 0405. A college or graduate-school application the game raised
   * unprompted, if one is open — the same reason `offer` exists: a
   * `PendingDecision` carries strings, and `@yearafter/events` must not learn
   * what a major is to deliver one.
   */
  readonly collegeOffer?: CollegeOffer;
  /**
   * Ticket 0410. A step in a private life the game raised unprompted, if one
   * is open — asking somebody out, making it official, proposing, the wedding,
   * or trying for a child.
   *
   * ONE FIELD FOR TWO QUESTIONS, deliberately. A romantic step and a child are
   * different questions and carry different event ids, but only one of them can
   * ever be open at a time (`withLifeOffer` raises at most one a year, and
   * `pending` already holds at most one decision), so a second save field would
   * describe a state that cannot occur. 0407 made the opposite call for the
   * same reason, from the other side: two job offers were one question with two
   * entry conditions, so they share an id as well as a field.
   */
  readonly lifeOffer?: LifeOffer;
  /**
   * Ticket 0416. A club, team or pursuit the game asked about unprompted, if
   * one is open. Its own field rather than a third `LifeOffer` variant: that
   * union is about the people in a private life, and answering this runs the
   * activity verbs, not the romance ones.
   */
  readonly pursuitOffer?: PursuitOffer;
  /**
   * Ticket 0501. The homes the character owns, each carrying its own mortgage.
   * Empty for almost every save written before it, which is why it is not
   * optional: an empty list is a true statement about those lives.
   */
  readonly homes: readonly OwnedHome[];
  /** Ticket 0501. A home the game asked about unprompted, if one is open. */
  readonly homeOffer?: HomeOffer;
  /**
   * Ticket 0504. The cars the character owns, each carrying its own loan. Not
   * optional, for the reason `homes` is not: an empty list is a true
   * statement about every life before it.
   */
  readonly vehicles: readonly OwnedVehicle[];
  /** Ticket 0504. A car the game asked about unprompted, if one is open. */
  readonly vehicleOffer?: VehicleOffer;
  /**
   * Ticket 0504. The used listings somebody paid to have inspected this year.
   * Only the ids: what an inspection finds is derived from the listing, so it
   * finds the same thing however often the screen asks. Cleared by the year
   * — a listing id carries its year, so last year's inspections simply stop
   * matching anything.
   */
  readonly inspected?: readonly string[];
  /**
   * Ticket 0506. Jewelry, watches and collectibles the character owns. Not
   * optional, for the reason `homes` and `vehicles` are not.
   */
  readonly valuables: readonly OwnedValuable[];
  /** Ticket 0506. A renovation the game asked about unprompted, if one is open. */
  readonly renovationOffer?: RenovationOffer;
  /**
   * Ticket 0507. This year's auction diary: how many sales attended at each
   * venue (spec 41's yearly limits) and which lots were bid on. A diary for
   * an earlier year means nothing has been attended this year.
   */
  readonly auctions?: AuctionDiary;
  /**
   * Ticket 0601. The businesses the character owns, each with its own money.
   * Not optional, for the reason `homes` is not.
   */
  readonly businesses: readonly OwnedBusiness[];
  /** Ticket 0605. The private deals the character has made. Always present from v40. */
  readonly deals: readonly PrivateDeal[];
  /** Live RNG registry. Serialised into the save on every write. */
  readonly rng: Rng;
}

/**
 * Ticket 0402 — an offer on the table.
 *
 * Everything needed to honour it later, captured when it was MADE. The pay and
 * the employer are stored rather than re-derived because the player may answer
 * days later on another device, and an offer that quietly changes its number
 * between being read and being accepted is a lie the save told.
 */
export interface JobOffer {
  readonly jobId: string;
  /** Who is asking. Drawn once, at the moment the offer was made. */
  readonly employer: string;
  /** Advertised pay of the offered job, as it was described. */
  readonly pay: number;
  /**
   * What they are on now, so the prompt can say what changes.
   *
   * ABSENT MEANS THEY HAVE NO JOB (Ticket 0407). The same offer carries both
   * doors: somebody poaching a worker (0402) and somebody offering work to
   * an adult who has none. They resolve identically — the difference is
   * entirely in what the prompt can say and whether there is a resignation to
   * record — so making this optional was the whole of the state change rather
   * than a second offer type with a second event id, a second save field and a
   * second `decide` branch to keep in step.
   */
  readonly fromJobId?: string;
  readonly age: number;
  /** The decision this offer belongs to, so the two are cleared together. */
  readonly eventId: string;
}

/**
 * Ticket 0405 — a college application the game is asking about.
 *
 * The major is drawn once, at the moment the question was raised, for the
 * same save-stability reason `JobOffer` freezes its pay and employer: the
 * player may answer on a later day than the one the offer was made.
 */
export interface CollegeOffer {
  readonly majorId: string;
  /** Whether this is the postgraduate question rather than the undergraduate one. */
  readonly postgrad: boolean;
  readonly age: number;
  /** The decision this offer belongs to, so the two are cleared together. */
  readonly eventId: string;
}

/**
 * Ticket 0410 — a step in a private life the game is asking about.
 *
 * Frozen at the moment the question was raised, for the same save-stability
 * reason `JobOffer` freezes its pay: the player may answer on a later day.
 *
 * `personId` and `moveId` rather than a copy of the person and the move. The
 * person is an `Acquaintance` and stays one — duplicating them here is the
 * two-places-disagree failure CORE_RULES 13.19 exists to prevent, and this time
 * the two records would disagree about who the player is seeing.
 */
export type LifeOffer =
  | {
      readonly kind: 'romance';
      /** Who the question is about, as their id in the social circle. */
      readonly personId: string;
      /** The `RomanceMove` answering yes runs. The ladder is the social package's. */
      readonly moveId: string;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      readonly kind: 'child';
      readonly route: 'baby' | 'adopt';
      readonly age: number;
      readonly eventId: string;
    };

/**
 * Ticket 0416 — something to join, the game is asking about.
 *
 * Only the id and the age, frozen when it was raised: the activity is catalog
 * content and does not change between the question and the answer, and whether
 * a parent pays or the tryout is passed is decided by the real verb at the
 * moment of answering, exactly as a tap would decide it.
 */
export interface PursuitOffer {
  readonly activityId: string;
  readonly age: number;
  readonly eventId: string;
}

/**
 * Ticket 0501 — a home the game is asking about. The listing id only: the
 * listing is derived from the seed and the year, so it is the same home when
 * the question is answered as when it was asked.
 */
export interface HomeOffer {
  readonly listingId: string;
  readonly age: number;
  readonly eventId: string;
}

/**
 * Ticket 0504 — a car the game is asking about. The listing id, and the car it
 * would replace if there is one; both are derived or owned, so the question
 * reads the same whenever it is answered.
 */
/**
 * Ticket 0506 — a renovation the game is asking about: which home, which job,
 * and the price as it was when asked (a price that changed between the
 * question and the answer is the 0402 lesson).
 */
export interface RenovationOffer {
  readonly homeId: string;
  readonly renovationId: string;
  readonly cost: number;
  readonly age: number;
  readonly eventId: string;
}

/** Ticket 0507 — see `GameState.auctions`. */
export interface AuctionDiary {
  readonly year: number;
  readonly visits: Readonly<Record<string, number>>;
  readonly bids: readonly string[];
}

export interface VehicleOffer {
  readonly listingId: string;
  readonly tradeInId?: string;
  readonly how: 'cash' | 'loan';
  readonly age: number;
  readonly eventId: string;
}

/**
 * Whether a systemic offer is already open (Ticket 0410).
 *
 * Every systemic door used to open with `if (state.pending.length > 0) return
 * state`, and `advanceYear`'s own comment says why that was safe in 0402:
 * *"Measured, that risks nothing — an adult year contains zero authored
 * decisions, because every one in the catalog stops at seventeen."*
 *
 * 0409 wrote thirteen adult decisions and made that sentence false. Measured
 * across 4,838 adult years afterwards, **59.4% of them already held an authored
 * decision by the time the doors ran**, so all three were shut in three years
 * out of five — a guard silently turned into a throttle by a change in a
 * different package, which is CORE_RULES 13.36's shape from the other side: not
 * a field nothing writes, but a condition whose justification expired without
 * the code that rests on it noticing.
 *
 * What the guard was actually for is one systemic question a year, and that is
 * what it asks now. The queue has always been a list and already carries two
 * decisions in 641 adult years out of 4,838 and three in 70, so nothing
 * downstream learns anything new.
 */
export const hasSystemicOffer = (state: GameState): boolean =>
  state.offer !== undefined ||
  state.collegeOffer !== undefined ||
  state.lifeOffer !== undefined ||
  state.pursuitOffer !== undefined ||
  state.homeOffer !== undefined ||
  state.vehicleOffer !== undefined ||
  state.renovationOffer !== undefined;

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
  readonly offer?: JobOffer;
  readonly collegeOffer?: CollegeOffer;
  readonly lifeOffer?: LifeOffer;
  readonly pursuitOffer?: PursuitOffer;
  readonly homes?: readonly OwnedHome[];
  readonly homeOffer?: HomeOffer;
  readonly vehicles?: readonly OwnedVehicle[];
  readonly vehicleOffer?: VehicleOffer;
  readonly inspected?: readonly string[];
  readonly valuables?: readonly OwnedValuable[];
  readonly renovationOffer?: RenovationOffer;
  readonly auctions?: AuctionDiary;
  readonly businesses?: readonly OwnedBusiness[];
  readonly deals?: readonly PrivateDeal[];
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
  ...(options.offer ? { offer: options.offer } : {}),
  ...(options.collegeOffer ? { collegeOffer: options.collegeOffer } : {}),
  ...(options.lifeOffer ? { lifeOffer: options.lifeOffer } : {}),
  ...(options.pursuitOffer ? { pursuitOffer: options.pursuitOffer } : {}),
  homes: options.homes ?? EMPTY_HOMES,
  ...(options.homeOffer ? { homeOffer: options.homeOffer } : {}),
  vehicles: options.vehicles ?? EMPTY_VEHICLES,
  ...(options.vehicleOffer ? { vehicleOffer: options.vehicleOffer } : {}),
  ...(options.inspected && options.inspected.length > 0 ? { inspected: options.inspected } : {}),
  valuables: options.valuables ?? EMPTY_VALUABLES,
  ...(options.renovationOffer ? { renovationOffer: options.renovationOffer } : {}),
  ...(options.auctions ? { auctions: options.auctions } : {}),
  businesses: options.businesses ?? EMPTY_BUSINESSES,
  deals: options.deals ?? EMPTY_DEALS,
  pending: options.pending ?? [],
  rng,
});
