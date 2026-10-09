import { businessAgentEffects, businessPrice, type BusinessAgentLevel } from './business-agents';
/**
 * Ticket 0601 — what a business is and what a year of it does.
 *
 * Spec 393–413, 849–878 and 1392: a business's performance "depends on
 * product/service quality, supplier, pricing, payroll, demand, brand
 * reputation, economy, owner decisions, and weighted random events", with
 * competition that "should not dominate" and "starting/acquisition economics"
 * that "prevent trivial scale exploits".
 *
 * THE SHAPE, ONE YEAR AT A TIME. A business sells what customers want to buy,
 * up to what it has the hands to serve:
 *
 *   demand    = what it sells at maturity
 *               × how far along it is (a new business has no regulars)
 *               × the economy, felt by as much as the kind of business feels it
 *               × its name in town (reputation)
 *               × the quality of what it offers (what it buys, who serves it)
 *               × the owner's knack for this sort of thing
 *               × how the place landed with its neighbourhood (drawn once)
 *               × how this year went (drawn each year)
 *               × the price, to the power of minus how touchy customers are
 *   capacity  = what a worker serves × (staff + the owner's hands)
 *   sold      = whichever is less
 *
 * Revenue is what it sold at the price it asked. The goods cost what they cost
 * however high the price goes. Pay and the lease are owed however it sells. What
 * is left is the owner's, and that is the whole of an owner's pay.
 *
 * WHY THE PRICE HAS A BEST ANSWER, AND WHY IT MOVES. A price that leaves
 * customers turned away is too low; one that leaves the staff idle is too high.
 * The best price is where demand just meets what the shop can serve — about the
 * going rate for an average business, higher for one everybody wants, lower for
 * one nobody does. The screen says which side of it you are on in words. The
 * same device as 0503's rent (CORE_RULES 13.89): the going rate is the best
 * answer for an ordinary business, and the slider is for noticing when yours
 * isn't ordinary.
 *
 * THE MONEY IS INSIDE THE BUSINESS. Spec 23: "business income inside the
 * business". A business holds its own cash. A year's profit goes into it, and
 * whatever is above a reserve of three months' costs is paid out to the owner
 * as income. A loss comes out of it, and then out of the owner. Nobody is asked
 * to move money between two accounts (spec 1126–1136 removes chores).
 *
 * WHAT HAPPENS TO IT. Expansion and a bigger catalog are 0602; business loans
 * and buying one that is already running are 0603. Ticket 0604 adds the rest:
 * a year can have a named event in it (a big order, a breakdown, a landlord), a
 * rival can open and fade, and a death passes the business to an heir. See
 * `business-events.ts`.
 */

import {
  supplierTerms,
  SUPPLIER_EFFECTS,
  type SupplierGrade,
  type SupplierAgreement,
  type SupplierSearch,
} from './suppliers';
import type { BusinessType } from '@yearafter/content';
import { cents, dollars, type Money } from '@yearafter/core';
import type { MarketState } from './investments';
import { NO_MODIFIERS, rivalTake, type Rival, type YearModifiers } from './business-events';

/* -------------------------------------------------------------------------- */
/* The owner's choices                                                         */
/* -------------------------------------------------------------------------- */

/** Spec 393 and 849–878's four, verbatim. */
export type Payroll = 'low' | 'medium' | 'high' | 'bigBucks';

export const PAYROLLS: readonly Payroll[] = ['low', 'medium', 'high', 'bigBucks'];

export const PAYROLL_LABELS: Readonly<Record<Payroll, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  bigBucks: 'Big Bucks',
};

/**
 * What a pay level does (spec 393: "staff quality, retention, morale, and
 * profitability"). `wage` is a multiple of what a job of this kind pays;
 * `quality` is how well the staff serve; `retention` is the share who stay a
 * year, and each who leaves costs a quarter of a year's pay to replace.
 *
 * MEASURED, NOT CHOSEN: no level wins everywhere. Low saves a seventh of the
 * wage bill and gives back more in customers than it saves wherever demand is
 * the limit, and costs nothing where it isn't. Big Bucks pays for itself only
 * where pay is a small share of what is sold — a software company, an
 * accounting firm — and loses money in a restaurant.
 */
export const PAYROLL_EFFECTS: Readonly<
  Record<Payroll, { readonly wage: number; readonly quality: number; readonly retention: number }>
> = {
  low: { wage: 0.88, quality: 0.92, retention: 0.72 },
  medium: { wage: 1, quality: 1, retention: 0.85 },
  high: { wage: 1.12, quality: 1.07, retention: 0.93 },
  bigBucks: { wage: 1.3, quality: 1.15, retention: 0.97 },
};

/** The share of a year's pay it costs to replace somebody who left. */
export const REPLACEMENT_SHARE = 0.25;

export {
  SUPPLIER_EFFECTS,
  SUPPLIER_GRADES,
  SUPPLIER_LABELS,
  type SupplierGrade,
} from './suppliers';

/** Spec 400: "Use a slider." Percent of the going price, in steps. */
export const PRICE_MIN = 70;
export const PRICE_MAX = 140;
export const PRICE_STEP = 5;
export const PRICE_STEPS: readonly number[] = Array.from(
  { length: (PRICE_MAX - PRICE_MIN) / PRICE_STEP + 1 },
  (_, index) => PRICE_MIN + index * PRICE_STEP,
);

export const clampPrice = (value: number): number =>
  Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(value / PRICE_STEP) * PRICE_STEP));

/** Staff can be hired up to this multiple of the headcount that serves a business's revenue. */
export const STAFF_CEILING = 1.6;
/** Nobody opens an eighth business. Spec 1392: acquisition economics must not allow trivial scale. */
export const MAX_BUSINESSES = 3;
export const OPEN_FROM_AGE = 18;

/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

/** Spec 1331's expansion. Four locations is a chain; a fifth is a different game. */
export const MAX_LOCATIONS = 4;

/**
 * What each location brings in at maturity, against the first. A second shop
 * takes some of the first one's customers and is never quite as good a site,
 * so the share falls: 1, then 0.85, 0.72, 0.61.
 */
export const LOCATION_SHARE: readonly number[] = [1, 0.9, 0.8, 0.7];

/** What opening another costs, against opening the first. A name and a system are already paid for. */
export const BRANCH_COST_SHARE = 0.65;

/** A branch carries the head office, the insurance and the accountant already; it pays this much of the first location's overhead. */
export const BRANCH_OVERHEAD_SHARE = 0.75;

/** A branch opens under a known name: it starts better than a stranger does. */
export const BRANCH_OPENING_MATURITY = 0.72;

/** Years the first location must have traded, and earned, before an owner can open a second. */
export const EXPAND_AFTER_YEARS = 2;

/** How much less of the owner each location gets as there are more of them. */
export const locationAttention = (locations: number): number => 1 / Math.max(1, locations) ** 0.5;

export const locationsOf = (business: Pick<OwnedBusiness, 'branches'>): number =>
  1 + (business.branches?.length ?? 0);

/** What a number of locations would bring in at full maturity, in units of one. */
export const reachOf = (locations: number): number =>
  LOCATION_SHARE.slice(0, Math.max(1, Math.min(MAX_LOCATIONS, locations))).reduce(
    (sum, share) => sum + share,
    0,
  );

/* -------------------------------------------------------------------------- */
/* A business                                                                  */
/* -------------------------------------------------------------------------- */

/** Last year's figures, whole dollars, for the dashboard. */
export interface BusinessLedgerYear {
  readonly year: number;
  readonly revenue: number;
  readonly costs: number;
  readonly profit: number;
  /** What was paid out to the owner. */
  readonly drawn: number;
  /** What the owner put in to cover a loss. */
  readonly injected: number;
  /** The share of what customers wanted that the business could not serve. */
  readonly turnedAway: number;
  /** The share of what the business could serve that nobody wanted. */
  readonly idle: number;
  /** Ticket 0603. What went to the bank this year, interest and principal. */
  readonly repaid?: number;
  /** Ticket 0604. The id of what happened to it this year, if anything. */
  readonly event?: string;
  /** Ticket 0604. How much of its custom the economy left it, 1 being all of it. */
  readonly economy?: number;
  /** Ticket 0604. The share of its custom a rival took this year, if there is one. */
  readonly rivalTook?: number;
}

export interface OwnedBusiness {
  /** `biz:<year>:<n>`. Stable forever. */
  readonly id: string;
  readonly typeId: string;
  readonly name: string;
  readonly openedYear: number;
  /** What the owner has put in, startup and any losses covered since. */
  readonly invested: Money;
  /** The business's own cash. Spec 23: business income stays inside the business. */
  readonly cash: Money;
  /** Percent of the going price. */
  readonly price: number;
  readonly supplier: SupplierGrade;
  readonly agentLevel?: BusinessAgentLevel;
  readonly supplierAgreement?: SupplierAgreement;
  readonly supplierSearch?: SupplierSearch;
  readonly payroll: Payroll;
  readonly staff: number;
  /**
   * The business hires and lets people go to match what customers want, as a
   * manager would (spec 404: required staff are hired automatically; manual
   * control remains). Switched off the moment the owner hires or lets someone
   * go by hand, and back on from the same screen.
   */
  readonly autoStaff: boolean;
  /** 0–100. Shown as a phrase (spec 398's Brand Reputation). */
  readonly reputation: number;
  /** How the place landed with its neighbourhood, drawn once at opening. 0.55–1.45. */
  readonly luck: number;
  /** The last three years' profit, oldest first. A valuation looks at these. */
  readonly profits: readonly number[];
  /**
   * Ticket 0602: the years each EXTRA location opened, oldest first. The first
   * location is the business itself (`openedYear`); an empty list is a
   * business with one door, which is every business before 0602.
   */
  readonly branches: readonly number[];
  /** Ticket 0604. Somebody who opened nearby and is still taking a little of its custom. */
  readonly rival?: Rival;
  readonly last?: BusinessLedgerYear;
}

export const EMPTY_BUSINESSES: readonly OwnedBusiness[] = [];

/* -------------------------------------------------------------------------- */
/* What the world does to demand                                               */
/* -------------------------------------------------------------------------- */

/**
 * How much of a business's custom survives each of spec 1222's states, for a
 * business that feels the whole of it. "Effects should be moderate rather than
 * constantly punitive". P4 halves the ordinary effects; Payton kept the +9% boom.
 */
export const ECONOMY_DEMAND: Readonly<Record<MarketState, number>> = {
  severeRecession: 0.87,
  recession: 0.935,
  slowdown: 0.975,
  normal: 1,
  growth: 1.025,
  strongExpansion: 1.09,
};

/** P4: keep reduced effects legible in existing context, not a new economy screen. */
export const BUSINESS_ECONOMY_LEDGER_THRESHOLD = 0.0025;
export const BUSINESS_ECONOMY_SCREEN_THRESHOLD = 0.015;
export const BUSINESS_ECONOMY_LOSS_THRESHOLD = 0.03;
export const BUSINESS_ECONOMY_GAIN_THRESHOLD = 0.025;

/** Compare multipliers so subtraction cannot hide an exact threshold such as 1.015. */
export const businessEconomyVisible = (
  economy: number | undefined,
  threshold = BUSINESS_ECONOMY_SCREEN_THRESHOLD,
): boolean => economy !== undefined && (economy <= 1 - threshold || economy >= 1 + threshold);

/** One unit of float tolerance keeps an exact half-percent from rounding the wrong way. */
export const businessEconomyPercent = (economy: number): number =>
  Math.round((Math.abs(economy - 1) + Number.EPSILON) * 100);

/** What a business of this kind sees of the economy. */
export const economyFor = (state: MarketState, cyclical: number): number =>
  1 + (ECONOMY_DEMAND[state] - 1) * cyclical;

/**
 * How far along a business is. Spec: a new business has no regulars. It opens
 * at under half of what it will be and gets there over a few years.
 */
export const MATURITY_AT_OPENING = 0.55;

/** How much more a new business's year can swing than an established one's. */
export const FRAGILITY = 0.9;

export function maturityFor(age: number, ramp: number): number {
  const years = Math.max(0, age);
  return MATURITY_AT_OPENING + (1 - MATURITY_AT_OPENING) * (1 - Math.exp(-years / ramp));
}

/**
 * How much of what customers get is the people. A law firm is nearly all of it;
 * a vehicle rental lot is cars, and a friendlier counter clerk moves its
 * custom a good deal less. Wages as a share of revenue, against the share at
 * which service is the whole product (a third).
 */
export const serviceNoticedIn = (type: BusinessType): number =>
  Math.min(1, (type.staff * type.wage) / type.revenue / 0.3);

/** How good what a business offers is. 1 is ordinary. */
export function qualityOf(
  type: BusinessType,
  supplier: SupplierGrade,
  payroll: Payroll,
  goods = SUPPLIER_EFFECTS[supplier].quality,
): number {
  const service = PAYROLL_EFFECTS[payroll].quality;
  const weight = type.supplier ? type.productShare : 0;
  return goods ** weight * (service ** serviceNoticedIn(type)) ** (1 - weight);
}

/** Reputation, as a demand multiplier. Fifty is ordinary; a name in town is worth a good deal. */
export const reputationFactor = (reputation: number): number => 0.6 + 0.8 * (reputation / 100);

export const REPUTATION_WORDS: readonly { readonly from: number; readonly word: string }[] = [
  { from: 80, word: 'Beloved' },
  { from: 62, word: 'Well liked' },
  { from: 42, word: 'Known in town' },
  { from: 22, word: 'Little known' },
  { from: 0, word: 'Not good' },
];

export const reputationWord = (reputation: number): string =>
  (
    REPUTATION_WORDS.find((row) => reputation >= row.from) ??
    REPUTATION_WORDS[REPUTATION_WORDS.length - 1]!
  ).word;

export const OPENING_REPUTATION = 35;

/**
 * The owner's knack: 0.9 to 1.1 from the two stats that help in this kind of
 * business (average 0–100), weighted by how much of the day they are there.
 */
export function ownerFactor(averageStat: number, hands: number): number {
  const knack = 0.9 + 0.2 * (Math.max(0, Math.min(100, averageStat)) / 100);
  return 1 + (knack - 1) * hands;
}

/**
 * How much of themselves an owner gives to this business: all of it to one,
 * less to two or three, and a good deal less if they also hold a job.
 */
export const JOB_ATTENTION = 0.55;
export function handsOn(businessesOwned: number, holdsJob: boolean): number {
  const split = 1 / Math.max(1, businessesOwned) ** 0.75;
  return split * (holdsJob ? JOB_ATTENTION : 1);
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How much custom the business draws this year, in units of one mature
 * location: each location's share of the first, times how far along it is.
 * One location is exactly `maturityFor`, which is what every business before
 * 0602 used.
 */
export function footprintFor(
  business: Pick<OwnedBusiness, 'openedYear' | 'branches'>,
  type: Pick<BusinessType, 'ramp'>,
  year: number,
): number {
  const opened = [business.openedYear, ...(business.branches ?? [])];
  return opened.slice(0, MAX_LOCATIONS).reduce((sum, openedYear, index) => {
    const age = Math.max(0, year - openedYear - 1);
    const grown = maturityFor(age, type.ramp);
    const level =
      index === 0
        ? grown
        : BRANCH_OPENING_MATURITY +
          (1 - BRANCH_OPENING_MATURITY) *
            ((grown - MATURITY_AT_OPENING) / (1 - MATURITY_AT_OPENING));
    return sum + (LOCATION_SHARE[index] ?? 0) * level;
  }, 0);
}

export interface BusinessYearInput {
  readonly year: number;
  readonly market: MarketState;
  /** A standard normal draw for this business this year. */
  readonly shock: number;
  /** The average of the two stats that help, 0–100. */
  readonly stat: number;
  /** How much of themselves the owner gives to it. */
  readonly hands: number;
  /** Ticket 0604. What this year's event did, if one happened. Nothing by default. */
  readonly modifiers?: YearModifiers;
}

export interface BusinessYearResult {
  readonly revenue: number;
  readonly cogs: number;
  readonly labor: number;
  readonly overhead: number;
  readonly costs: number;
  readonly profit: number;
  readonly turnedAway: number;
  readonly idle: number;
  readonly reputation: number;
  /** Units, in dollars of revenue at the going price. */
  readonly demand: number;
  readonly capacity: number;
  /** Ticket 0604. The one-off cost an event added, whole dollars; negative if it brought money in. */
  readonly extra: number;
  /** Ticket 0604. The multiplier on demand that the economy was. */
  readonly economy: number;
  /** Ticket 0604. The share of custom the rival took, 0 with none. */
  readonly rivalTook: number;
}

/** The pay bill at this level, including what turnover costs. */
export function laborCostFor(type: BusinessType, staff: number, payroll: Payroll): number {
  const level = PAYROLL_EFFECTS[payroll];
  const turnover = (1 - level.retention) * REPLACEMENT_SHARE;
  return Math.round(staff * type.wage * level.wage * (1 + turnover));
}

/**
 * The share of its capacity a well-staffed business uses in an ordinary year.
 * A shop that can serve exactly an average year turns people away in every
 * good one; a real one is built with room.
 */
export const UTILISATION = 0.88;

/** What one worker, the owner or staff, can serve in a year. */
export const perWorkerOf = (type: BusinessType): number =>
  type.revenue / (type.staff + 1) / UTILISATION;

/** A business with fewer than its minimum cannot open the doors. */
export const MINIMUM_STAFF_CAPACITY = 0.3;

export function businessYear(
  business: OwnedBusiness,
  type: BusinessType,
  input: BusinessYearInput,
): BusinessYearResult {
  // The year it opens is a part-year and is not played; the first full year is age zero.
  const age = input.year - business.openedYear - 1;
  // A young business is fragile: a bad year can sink it in a way it cannot once it has regulars.
  const spread = type.volatility * (1 + FRAGILITY * Math.exp(-Math.max(0, age) / 1.5));
  const locations = locationsOf(business);
  // One owner can only be at one door.
  const hands = input.hands * locationAttention(locations);
  const price = businessPrice(business) / 100;
  const quality = qualityOf(
    type,
    business.supplier,
    business.payroll,
    supplierTerms(business).quality,
  );

  const modifiers = input.modifiers ?? NO_MODIFIERS;
  const economy = economyFor(input.market, type.cyclical);
  const rivalTook = rivalTake(business.rival, input.year, business.reputation);

  // Spec 400: price. Spec 1222: the economy. Spec 1392: everything else.
  const demand =
    type.revenue *
    footprintFor(business, type, input.year) *
    economy *
    (1 - rivalTook) *
    modifiers.demand *
    businessAgentEffects(business).clients *
    reputationFactor(business.reputation) *
    ownerFactor(input.stat, hands) *
    business.luck *
    Math.exp(spread * input.shock - (spread * spread) / 2) *
    // Customers weigh what they pay against what they get: a better thing at a
    // higher price is the same offer.
    (price / quality) ** -type.elasticity;

  const workers = business.staff + hands;
  const open = business.staff >= type.staffMin * locations;
  const capacity =
    perWorkerOf(type) * workers * (type.headroom ?? 1) * (open ? 1 : MINIMUM_STAFF_CAPACITY);

  const sold = Math.min(demand, capacity);
  const revenue = sold * price;
  const cogs = sold * type.cogs * supplierTerms(business).cost * modifiers.cogs;
  const labor = agentLaborCost(business, laborCostFor(type, business.staff, business.payroll));
  const overhead =
    type.overhead * (1 + BRANCH_OVERHEAD_SHARE * (locations - 1)) * modifiers.overhead;
  // An event's one-off is sized to the business, not to the year it had.
  const extra = Math.round(modifiers.extra * type.revenue * reachOf(locations));
  const costs = cogs + labor + overhead + extra;

  const turnedAway = demand > 0 ? Math.max(0, 1 - capacity / demand) : 0;
  const idle = capacity > 0 ? Math.max(0, 1 - demand / capacity) : 0;

  /*
    A name in town follows what people get for what they pay. A better thing
    sells better and is talked about; a price above the going rate is, too; a
    shop too busy to serve everybody loses a little of both.
  */
  const value = price > 1 ? -50 * (price - 1) : Math.min(15, 25 * (1 - price));
  const rush = turnedAway > 0.15 ? -Math.min(10, turnedAway * 30) : 0;
  const target = Math.max(5, Math.min(98, 50 + 110 * (quality - 1) + value + rush));
  const reputation = Math.max(
    0,
    Math.min(100, Math.round(business.reputation + 0.35 * (target - business.reputation))),
  );

  return {
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    labor,
    overhead,
    costs: Math.round(costs),
    profit: Math.round(revenue - costs),
    turnedAway,
    idle,
    reputation,
    demand,
    capacity,
    extra,
    economy,
    rivalTook,
  };
}

/**
 * What a manager would do about staffing, from how the year went: hire when
 * customers were turned away, let people go when the work is not there, and
 * never below what the doors need or above what the place can hold. A few at a
 * time in either direction, because a business that doubles its staff in a year
 * is not being run.
 */
export function autoStaffFor(
  type: BusinessType,
  staff: number,
  result: Pick<BusinessYearResult, 'demand'>,
  growth: number,
  hands: number,
  locations = 1,
): number {
  const wanted = Math.ceil((result.demand * growth) / perWorkerOf(type) - hands);
  const target = Math.max(
    type.staffMin * locations,
    Math.min(staffCeilingFor(type, locations), wanted),
  );
  // A few at a time in a small shop; a few in every ten in a big one, or a
  // seventy-room resort would take a dozen years to find its staff.
  const up = Math.max(3, Math.ceil(staff * 0.15));
  const down = Math.max(2, Math.ceil(staff * 0.1));
  if (target > staff) return Math.min(target, staff + up);
  if (target < staff) return Math.max(target, staff - down);
  return staff;
}

/* -------------------------------------------------------------------------- */
/* Where the money goes                                                        */
/* -------------------------------------------------------------------------- */

/** Three months of what it costs to run is kept in the business. */
export const RESERVE_MONTHS = 3;

export const reserveFor = (costs: number): number =>
  Math.max(5_000, Math.round((costs * RESERVE_MONTHS) / 12));

export interface BusinessSettlement {
  /** The business's cash at the end of the year, before the owner covers anything. */
  readonly cash: number;
  /** Paid out to the owner. */
  readonly drawn: number;
  /** What the owner must put in to cover a loss, so the business does not go under. */
  readonly needed: number;
}

/**
 * The year's profit goes in, anything above the reserve comes out, and a loss
 * that empties the till is for the owner to cover. A cash of zero or more is a
 * business that is still open.
 */
export function settleYear(cash: number, profit: number, costs: number): BusinessSettlement {
  const reserve = reserveFor(costs);
  const after = cash + profit;
  if (after < 0) {
    // Cover the hole and a half a reserve, so next year does not open on nothing.
    return { cash: after, drawn: 0, needed: Math.round(-after + reserve / 2) };
  }
  const drawn = Math.max(0, Math.round(after - reserve));
  return { cash: after - drawn, drawn, needed: 0 };
}

/* -------------------------------------------------------------------------- */
/* Value                                                                       */
/* -------------------------------------------------------------------------- */

export const ASSET_DEPRECIATION = 0.08;
export const ASSET_FLOOR = 0.25;

/** What the fittings and equipment would fetch, whole dollars. Falls with age, never to nothing. */
export function assetValueFor(
  type: BusinessType,
  openedYear: number,
  year: number,
  branches: readonly number[] = [],
): number {
  const kept = (since: number): number =>
    Math.max(ASSET_FLOOR, (1 - ASSET_DEPRECIATION) ** Math.max(0, year - since));
  const first = type.startup * type.assetShare * kept(openedYear);
  const more = branches.reduce(
    (sum, since) => sum + type.startup * BRANCH_COST_SHARE * type.assetShare * kept(since),
    0,
  );
  return Math.round(first + more);
}

/** What the business is worth without its cash, whole dollars: years of profit, or its fittings if that is more. */
export function goingConcernFor(business: OwnedBusiness, type: BusinessType, year: number): number {
  const history = business.profits.filter((profit) => Number.isFinite(profit));
  const average = history.length > 0 ? history.reduce((sum, p) => sum + p, 0) / history.length : 0;
  const multiple = type.valueMultiple * (0.85 + 0.3 * (business.reputation / 100));
  const earning = Math.max(0, average) * multiple;
  return Math.round(
    Math.max(assetValueFor(type, business.openedYear, year, business.branches), earning),
  );
}

/** What it is worth to its owner: the business, and the money in the till. */
export function businessValueFor(
  business: OwnedBusiness,
  type: BusinessType,
  year: number,
): number {
  return goingConcernFor(business, type, year) + Math.round(Number(business.cash) / 100);
}

export interface BusinessAppraisal {
  readonly low: number;
  readonly high: number;
}

const stepFor = (n: number): number =>
  n >= 1_000_000 ? 25_000 : n >= 100_000 ? 5_000 : n >= 10_000 ? 500 : 100;

const nice = (n: number): number => {
  const step = stepFor(n);
  return Math.max(step, Math.round(n / step) * step);
};

/** Rounded up, for a price that must never come out under what it was meant to be. */
const niceUp = (n: number): number => {
  const step = stepFor(n);
  return Math.max(step, Math.ceil(n / step) * step);
};

/** Spec 398's Request Valuation: an appraiser's range, a little off in either direction. */
export function businessAppraisalFor(value: number, roll: number): BusinessAppraisal {
  const centre = value * (0.94 + 0.12 * roll);
  return { low: nice(centre * 0.9), high: nice(centre * 1.1) };
}

export const BROKER_FEE = 0.05;
/** How many standard deviations of haggling a buyer's offer may move by. */
export const SALE_Z_LIMIT = 2.5;
/** A buyer pays a little under what a business is worth to its owner, and haggles. */
export const BUYER_DISCOUNT = 0.94;

export interface BusinessSale {
  /** What the buyer pays for the business. */
  readonly price: number;
  readonly fee: number;
  /** The business's own cash, handed over with it. */
  readonly cash: number;
  /** What the owner ends up with. */
  readonly proceeds: number;
}

/** A buyer's offer. `z` is a standard normal draw, fixed for the year. */
export function businessSaleOf(
  business: OwnedBusiness,
  type: BusinessType,
  year: number,
  z: number,
): BusinessSale {
  const worth = goingConcernFor(business, type, year);
  // A buyer's haggling has a limit. Unclamped, one draw in a few hundred came
  // out far enough above the going price to beat what a seller had asked for it
  // (0603), and a number that can be farmed by buying and selling the same
  // business in the same year is not a number, it is a slot machine.
  const haggle = Math.max(-SALE_Z_LIMIT, Math.min(SALE_Z_LIMIT, z));
  const price = Math.max(0, Math.round(worth * BUYER_DISCOUNT * Math.exp(0.07 * haggle)));
  const fee = Math.round(price * BROKER_FEE);
  const cash = Math.max(0, Math.round(Number(business.cash) / 100));
  return { price, fee, cash, proceeds: price - fee + cash };
}

/** Closing the doors: the fittings go for a fraction, the till is the owner's. */
export const WIND_DOWN_SHARE = 0.4;

export function windDownOf(business: OwnedBusiness, type: BusinessType, year: number): number {
  const fittings = Math.round(
    assetValueFor(type, business.openedYear, year, business.branches) * WIND_DOWN_SHARE,
  );
  return fittings + Math.max(0, Math.round(Number(business.cash) / 100));
}

/* -------------------------------------------------------------------------- */
/* Opening                                                                     */
/* -------------------------------------------------------------------------- */

/** What the owner must put in to open. Spec 1392: nothing is free. */
export const startupCostFor = (type: BusinessType): number => type.startup;

/** The share of the startup that is cash in the till rather than fittings. */
export const floatFor = (type: BusinessType): number =>
  Math.round(type.startup * (1 - type.assetShare));

/** Hired at opening: what the doors need, and no more. It grows as the customers come. */
export const openingStaffFor = (type: BusinessType): number => type.staffMin;

export const staffCeilingFor = (type: BusinessType, locations = 1): number =>
  Math.ceil(type.staff * STAFF_CEILING * reachOf(locations));

/**
 * Whether a type shows up for somebody worth this much. Spec 912: wealth gates
 * the list and nothing on the list says which tier it is. 0601 measured wealth
 * as cash and portfolio; 0602 measures it as net worth, which is what spec 912
 * says and what 0601's own comment on `gate` said it meant.
 */
export const visibleTo = (type: BusinessType, netWorth: number): boolean => netWorth >= type.gate;

/* -------------------------------------------------------------------------- */
/* Expanding                                                                   */
/* -------------------------------------------------------------------------- */

export type ExpandRefusal = 'at-limit' | 'too-new' | 'not-earning' | 'cannot-afford';

export const EXPAND_REFUSAL_LABELS: Readonly<Record<ExpandRefusal, string>> = {
  'at-limit': "That's as many locations as you can run.",
  'too-new': "It hasn't traded long enough to know it could carry another.",
  'not-earning': "It didn't earn last year. Fix that before you add to it.",
  'cannot-afford': "You don't have enough to open another.",
};

/** Whole dollars to open one more door: cheaper than the first, which paid for the name. */
export const branchCostFor = (type: BusinessType): number =>
  Math.round(type.startup * BRANCH_COST_SHARE);

/** What the owner is told when they ask to expand: nothing, or the reason not. */
export function expansionRefusal(
  business: OwnedBusiness,
  type: BusinessType,
  year: number,
  available: number,
): ExpandRefusal | undefined {
  if (locationsOf(business) >= MAX_LOCATIONS) return 'at-limit';
  const latest = Math.max(business.openedYear, ...(business.branches ?? []));
  if (year - latest < EXPAND_AFTER_YEARS) return 'too-new';
  if (!business.last || business.last.profit <= 0) return 'not-earning';
  if (available < branchCostFor(type)) return 'cannot-afford';
  return undefined;
}

/**
 * One more location. The fittings are the branch's own; the rest of what it
 * cost is working capital and goes into the till, as the first location's does.
 */
export function withBranch(
  business: OwnedBusiness,
  type: BusinessType,
  year: number,
): OwnedBusiness {
  const cost = branchCostFor(type);
  const float = Math.round(cost * (1 - type.assetShare));
  return {
    ...business,
    branches: [...(business.branches ?? []), year],
    // The new door opens with its own crew, as the first did.
    staff: Math.max(business.staff, type.staffMin * (locationsOf(business) + 1)),
    invested: dollars(Math.round(Number(business.invested) / 100) + cost),
    cash: dollars(Math.round(Number(business.cash) / 100) + float),
  };
}

/** Closing the newest location: what its fittings fetch, and the business shrinks to fit. */
export function withoutBranch(business: OwnedBusiness, type: BusinessType): OwnedBusiness {
  const branches = (business.branches ?? []).slice(0, -1);
  const ceiling = staffCeilingFor(type, 1 + branches.length);
  return { ...business, branches, staff: Math.min(business.staff, ceiling) };
}

export function branchWindDownOf(
  business: OwnedBusiness,
  type: BusinessType,
  year: number,
): number {
  const branches = business.branches ?? [];
  if (branches.length === 0) return 0;
  const latest = assetValueFor(type, business.openedYear, year, branches);
  const without = assetValueFor(type, business.openedYear, year, branches.slice(0, -1));
  return Math.round((latest - without) * WIND_DOWN_SHARE);
}

export type OpenRefusal = 'too-young' | 'too-many' | 'cannot-afford' | 'no-such-type';

export const OPEN_REFUSAL_LABELS: Readonly<Record<OpenRefusal, string>> = {
  'too-young': "You're too young to open a business.",
  'too-many': "You can't run more than three at once.",
  'cannot-afford': "You don't have enough to open it.",
  'no-such-type': "That isn't something you can open.",
};

export function newBusiness(
  type: BusinessType,
  id: string,
  name: string,
  year: number,
  luck: number,
): OwnedBusiness {
  return {
    id,
    typeId: type.id,
    name,
    openedYear: year,
    invested: dollars(type.startup),
    cash: dollars(floatFor(type)),
    price: 100,
    supplier: 'standard',
    payroll: 'medium',
    staff: openingStaffFor(type),
    autoStaff: true,
    reputation: OPENING_REPUTATION,
    luck,
    profits: [],
    branches: [],
  };
}

/** The owner's luck at opening: mostly 0.7–1.4, centred on 1, from a standard normal draw. */
export const luckFrom = (z: number): number =>
  Math.max(0.55, Math.min(1.45, Math.exp(0.2 * Math.max(-3, Math.min(3, z)))));

/** What the businesses are worth, for net worth. */
export function businessesValue(
  businesses: readonly OwnedBusiness[],
  find: (id: string) => BusinessType | undefined,
  year: number,
): Money {
  let total = 0;
  for (const business of businesses) {
    const type = find(business.typeId);
    if (type) total += businessValueFor(business, type, year);
  }
  return cents(total * 100);
}

/** The most recent three profits, with this year's on the end. */
export const withProfit = (profits: readonly number[], profit: number): readonly number[] =>
  [...profits, profit].slice(-3);

/* -------------------------------------------------------------------------- */
/* Businesses for sale (ticket 0603)                                           */
/* -------------------------------------------------------------------------- */

/*
  BUYING ONE THAT EXISTS, and why it cannot be a faster way to a bigger one.

  A business that already trades has what a new one spends years getting:
  regulars, a name, a crew that knows the work. That is worth paying for, and
  the price has to be more than it is worth or buying would simply beat
  building. Four things keep it honest, and each has a test that fails without
  it (CORE_RULES 13.92):

    ASKING MORE THAN IT IS WORTH. Never less than 8% over what the same
      formula values it at, usually 10–28%. A buyer's offer for your own
      business is 94% of its worth, less 5% to the broker, and capped at two and
      a half standard deviations of haggling — so buying and selling the same
      business in the same year loses money on every one of the draws, which a
      test walks through, not just on average.

    BOOKS THAT FLATTER. The profits shown are the seller's, and the seller
      polished them: up to a fifth, mostly nothing. What the business earns
      from here is what the engine says it earns, so a dressed-up set of books
      is an overpayment you find out about in the second year.

    A CHANGE OF HANDS. Customers are wary of a new owner: reputation drops
      four points and rebuilds.

    FINANCE. A business loan for a purchase is bounded by what the owner and
      the thing bought can pay back (see `businessLoanFor`), so the ceiling on a
      leveraged chain is what it earns, not what it costs.
*/

export const LISTINGS_PER_YEAR = 4;
/** The least a seller asks over what the business is worth. */
export const ASK_PREMIUM_MIN = 1.08;
export const ASK_PREMIUM_SPREAD = 0.2;
/** The most a seller can flatter three years of profit by. Skewed hard towards none. */
export const WINDOW_DRESSING_MAX = 0.2;
export const TRANSITION_REPUTATION = 4;

export interface ListingDraws {
  /** Unit draws. */
  readonly age: number;
  readonly doors: number;
  readonly reputation: number;
  readonly premium: number;
  readonly dressing: number;
  /** Standard normal draws. */
  readonly luck: number;
  readonly trend: number;
  readonly noise: readonly [number, number, number];
}

export interface BusinessListing {
  /** Also the id of the business once bought. */
  readonly id: string;
  readonly typeId: string;
  readonly name: string;
  /** Years it has traded. */
  readonly years: number;
  readonly locations: number;
  readonly reputation: number;
  readonly staff: number;
  /** The seller's last three years, oldest first. */
  readonly reported: readonly number[];
  /** What the seller wants, till included, whole dollars. */
  readonly ask: number;
  /** The money in the till that comes with it, whole dollars. */
  readonly till: number;
  /** What the formula says it is worth without the till. The appraiser sees this; the buyer does not. */
  readonly worth: number;
  /** The business as the buyer would own it, before the change of hands. */
  readonly business: OwnedBusiness;
}

const clampUnit = (n: number): number => Math.max(0, Math.min(1, n));

/** A business that has been running for years, settled into its staffing, run by a seller of average knack. */
export function listingFor(
  type: BusinessType,
  id: string,
  name: string,
  year: number,
  draws: ListingDraws,
): BusinessListing {
  const years = Math.min(19, 2 + Math.floor(clampUnit(draws.age) * 18));
  const doors =
    years >= 8
      ? draws.doors < 0.6
        ? 0
        : draws.doors < 0.88
          ? 1
          : 2
      : years >= 5
        ? draws.doors < 0.75
          ? 0
          : 1
        : 0;
  const openedYear = year - years;
  const branches = Array.from({ length: doors }, (_, index) => openedYear + 3 * (index + 1));
  const locations = 1 + branches.length;

  const base = newBusiness(type, id, name, openedYear, luckFrom(draws.luck));
  let settled: OwnedBusiness = {
    ...base,
    branches,
    reputation: Math.round(38 + 45 * clampUnit(draws.reputation)),
    staff: type.staffMin * locations,
  };
  // The staffing a manager would have settled on by now.
  let result = businessYear(settled, type, {
    year,
    market: 'normal',
    shock: 0,
    stat: 50,
    hands: 1,
  });
  for (let round = 0; round < 10; round += 1) {
    const growth =
      footprintFor(settled, type, year + 1) / Math.max(0.01, footprintFor(settled, type, year));
    const staff = autoStaffFor(
      type,
      settled.staff,
      result,
      growth,
      locationAttention(locations),
      locations,
    );
    if (staff === settled.staff) break;
    settled = { ...settled, staff };
    result = businessYear(settled, type, { year, market: 'normal', shock: 0, stat: 50, hands: 1 });
  }

  const drift = Math.max(-0.1, Math.min(0.1, 0.05 * draws.trend));
  const dressing = WINDOW_DRESSING_MAX * clampUnit(draws.dressing) ** 3;
  const shape = [1 - 2 * drift, 1 - drift, 1];
  const reported = shape.map((factor, index) =>
    Math.round(result.profit * factor * (1 + dressing) * (1 + 0.04 * (draws.noise[index] ?? 0))),
  );

  const till = reserveFor(result.costs);
  const booked: OwnedBusiness = {
    ...settled,
    cash: dollars(till),
    profits: reported,
    last: {
      year: year - 1,
      revenue: result.revenue,
      costs: result.revenue - (reported[2] ?? 0),
      profit: reported[2] ?? 0,
      drawn: Math.max(0, reported[2] ?? 0),
      injected: 0,
      turnedAway: result.turnedAway,
      idle: result.idle,
    },
  };
  const worth = goingConcernFor(booked, type, year);
  const premium = ASK_PREMIUM_MIN + ASK_PREMIUM_SPREAD * clampUnit(draws.premium);
  const ask = niceUp(worth * premium) + till;
  return {
    id,
    typeId: type.id,
    name,
    years,
    locations,
    reputation: booked.reputation,
    staff: booked.staff,
    reported,
    ask,
    till,
    worth,
    business: booked,
  };
}

/** The business the buyer ends up with: a name in town, a new face, and what they paid on the books. */
export function businessBought(listing: BusinessListing): OwnedBusiness {
  return {
    ...listing.business,
    invested: dollars(listing.ask),
    reputation: Math.max(0, listing.business.reputation - TRANSITION_REPUTATION),
  };
}

/** What the seller's books say it earns in a year, on average. */
export const reportedProfitOf = (listing: Pick<BusinessListing, 'reported'>): number =>
  Math.round(
    listing.reported.reduce((sum, profit) => sum + profit, 0) /
      Math.max(1, listing.reported.length),
  );

/** Annual pay for one agent at this team's payroll policy, including turnover cost. */
export const businessAgentPayPerHead = (business: OwnedBusiness, type: BusinessType): number =>
  agentLaborCost(business, laborCostFor(type, 1, business.payroll));

/** Use integer percentages so an exact half dollar rounds up, including 115%. */
const agentLaborCost = (business: OwnedBusiness, labor: number): number =>
  Math.round((labor * Math.round(businessAgentEffects(business).pay * 100)) / 100);
