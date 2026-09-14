/**
 * Ticket 0308c — what you hold, in units.
 *
 * 0308's `Holding` was `{ productId, contributed, value }`: a dollar blob that
 * grew. This one is `{ instrumentId, units, paid }` and its value is units
 * times today's price, which changes three things that matter:
 *
 *   THE VALUE IS DERIVED, never stored. There is exactly one place a holding is
 *   worth something and it is the price book, so a portfolio can never disagree
 *   with the market list about what a share costs (CORE_RULES 13.23, which this
 *   build has now paid for four times).
 *
 *   UNITS ARE THE THING YOU OWN. "412 shares of Northline Freight" is a
 *   sentence a player remembers; "$42,000 of stocks" is not.
 *
 *   WHAT YOU PAID IS SEPARATE FROM WHAT IT IS WORTH, so the screen can say "up
 *   $4,200" — the only number on an investment screen anybody actually wants.
 *
 * Units are held to four decimal places. Whole units only would make an
 * $18,400 coin unbuyable for most of a life, and unbounded fractions would drift
 * against a money model that is otherwise integer cents.
 */

import { cents, type Money } from '@yearafter/core';
import { findInstrument, type Instrument } from '@yearafter/content';
import { priceOf, type PriceBook } from './market';

/** Four decimal places, so a fraction of an expensive coin is still buyable. */
export const UNIT_PLACES = 4;
const UNIT_SCALE = 10 ** UNIT_PLACES;

export const roundUnits = (units: number): number => Math.round(units * UNIT_SCALE) / UNIT_SCALE;

export interface Holding {
  readonly instrumentId: string;
  /** How many, to four decimal places. */
  readonly units: number;
  /** Total paid in, net of what selling has taken back out. */
  readonly paid: Money;
  /**
   * Years until a bond returns its principal. Undefined for everything else.
   * 0308b built this mechanic; the catalog gives it issuers and terms.
   */
  readonly maturesIn?: number;
}

/** What one holding is worth today, in cents. */
export const holdingWorth = (book: PriceBook, holding: Holding): number =>
  Math.round(holding.units * priceOf(book, holding.instrumentId));

export const portfolioWorth = (book: PriceBook, holdings: readonly Holding[]): Money =>
  cents(holdings.reduce((sum, holding) => sum + holdingWorth(book, holding), 0));

export const portfolioPaid = (holdings: readonly Holding[]): Money =>
  cents(holdings.reduce((sum, holding) => sum + Number(holding.paid), 0));

/** Up or down across everything held, in whole dollars. */
export const portfolioGain = (book: PriceBook, holdings: readonly Holding[]): number =>
  (Number(portfolioWorth(book, holdings)) - Number(portfolioPaid(holdings))) / 100;

export const EMPTY_PORTFOLIO: readonly Holding[] = [];

/* -------------------------------------------------------------------------- */
/* Buying                                                                      */
/* -------------------------------------------------------------------------- */

export type TradeRefusal =
  'noSuchInstrument' | 'notEnoughForOneUnit' | 'noCash' | 'tooManyHoldings' | 'nothingHeld';

/**
 * How many separate positions somebody can run.
 *
 * Higher than 0308's seven because there are eighty-nine things to choose from
 * now and a real portfolio spreads. Low enough that the screen stays a list of
 * decisions rather than a spreadsheet.
 */
export const MAX_HOLDINGS = 14;

export function canBuy(
  book: PriceBook,
  holdings: readonly Holding[],
  instrument: Instrument,
  dollars: number,
  cashDollars: number,
): TradeRefusal | undefined {
  const held = holdings.some((holding) => holding.instrumentId === instrument.id);
  if (!held && holdings.length >= MAX_HOLDINGS) return 'tooManyHoldings';
  if (dollars > cashDollars) return 'noCash';
  const price = priceOf(book, instrument.id);
  if (price <= 0) return 'noSuchInstrument';
  /*
    A BOND IS SOLD IN WHOLE UNITS AT A $1,000 PAR, which is both the real
    convention and the reason "eight bonds" is a sentence. Everything else can
    be bought in fractions, so the only floor is one unit's worth of price at
    four decimal places.
  */
  const smallest = instrument.kind === 'bond' ? price : Math.ceil(price / UNIT_SCALE);
  if (dollars * 100 < smallest) return 'notEnoughForOneUnit';
  return undefined;
}

export interface Purchase {
  readonly holdings: readonly Holding[];
  /** Units acquired. */
  readonly units: number;
  /** What it actually cost, in whole dollars — units are rounded down. */
  readonly spent: number;
}

/**
 * Buy as many units as the money covers, and spend only what they cost.
 *
 * ROUNDING DOWN AND RETURNING THE CHANGE is the honest shape. A player who
 * puts $5,000 into a $103.25 share gets 48.4261 units and spends $5,000 — but a
 * BOND is whole units, so $5,000 buys five and $5,000 must not leave the
 * account. Charging the asked-for amount and quietly keeping the difference is
 * the same defect as the card row that said "some" and spent everything.
 */
export function buyUnits(
  book: PriceBook,
  holdings: readonly Holding[],
  instrumentId: string,
  dollars: number,
): Purchase {
  const instrument = findInstrument(instrumentId);
  const price = priceOf(book, instrumentId);
  if (!instrument || price <= 0 || dollars <= 0) {
    return { holdings, units: 0, spent: 0 };
  }

  const raw = (dollars * 100) / price;
  const units = instrument.kind === 'bond' ? Math.floor(raw) : roundUnits(raw);
  if (units <= 0) return { holdings, units: 0, spent: 0 };

  const spent = Math.round((units * price) / 100);
  const existing = holdings.find((holding) => holding.instrumentId === instrumentId);
  const term = instrument.termYears;

  if (!existing) {
    return {
      holdings: [
        ...holdings,
        {
          instrumentId,
          units,
          paid: cents(spent * 100),
          ...(term > 0 ? { maturesIn: term } : {}),
        },
      ],
      units,
      spent,
    };
  }

  return {
    holdings: holdings.map((holding) =>
      holding.instrumentId === instrumentId
        ? {
            ...holding,
            units: roundUnits(holding.units + units),
            paid: cents(Number(holding.paid) + spent * 100),
            // Topping up a bond resets its clock: adding to one you hold is
            // buying a new one, and keeping the old date would be a permanent
            // ten-year bond that matures next year.
            ...(term > 0 ? { maturesIn: term } : {}),
          }
        : holding,
    ),
    units,
    spent,
  };
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

/** What leaving a bond before its date costs, as a share of what it is worth. */
export const EARLY_EXIT = 0.12;

export interface Sale {
  readonly holdings: readonly Holding[];
  /** Units sold. */
  readonly units: number;
  /** Cash raised in whole dollars, AFTER any early-exit discount. */
  readonly raised: number;
  /** The part of that which is gain rather than money returned. */
  readonly realized: number;
  /** What getting out early cost, in whole dollars. */
  readonly penalty: number;
}

const NOTHING = (holdings: readonly Holding[]): Sale => ({
  holdings,
  units: 0,
  raised: 0,
  realized: 0,
  penalty: 0,
});

/**
 * Sell units back to cash.
 *
 * What was PAID comes off pro rata with the units, which is what keeps "up
 * $4,200" honest after a partial sale: taking it off the paid figure first
 * would leave a half-sold winner claiming it had doubled again, and not taking
 * it off at all would leave it claiming a gain it had already banked.
 */
export function sellUnits(
  book: PriceBook,
  holdings: readonly Holding[],
  instrumentId: string,
  wantedUnits: number,
): Sale {
  const existing = holdings.find((holding) => holding.instrumentId === instrumentId);
  if (!existing) return NOTHING(holdings);

  const price = priceOf(book, instrumentId);
  const units = Math.min(roundUnits(Math.max(0, wantedUnits)), existing.units);
  if (units <= 0 || price <= 0) return NOTHING(holdings);

  const gross = Math.round(units * price);
  const early = existing.maturesIn !== undefined && existing.maturesIn > 0;
  const penalty = early ? Math.round(gross * EARLY_EXIT) : 0;

  const share = existing.units > 0 ? units / existing.units : 1;
  const paidOut = Math.round(Number(existing.paid) * share);
  const left = roundUnits(existing.units - units);

  const remaining: readonly Holding[] =
    left <= 0
      ? holdings.filter((holding) => holding.instrumentId !== instrumentId)
      : holdings.map((holding) =>
          holding.instrumentId === instrumentId
            ? {
                ...holding,
                units: left,
                paid: cents(Math.max(0, Number(holding.paid) - paidOut)),
              }
            : holding,
        );

  return {
    holdings: remaining,
    units,
    raised: Math.round((gross - penalty) / 100),
    realized: Math.round((gross - penalty - paidOut) / 100),
    penalty: Math.round(penalty / 100),
  };
}

/* -------------------------------------------------------------------------- */
/* Borrowing against it                                                        */
/* -------------------------------------------------------------------------- */

export const PLEDGEABLE_FROM = 75_000;
export const PLEDGE_SHARE = 0.4;

/**
 * What a private bank will lend against a portfolio.
 *
 * Crypto and penny stocks are not collateral. A bank lending against something
 * that can halve inside a year is not running a product, it is running the
 * bank's problem — and a penny stock can go to a cent, which the price engine
 * enforces rather than merely allows.
 */
export function pledgeableAgainst(book: PriceBook, holdings: readonly Holding[]): number {
  const worth = Number(portfolioWorth(book, holdings)) / 100;
  if (worth < PLEDGEABLE_FROM) return 0;
  const steady = holdings
    .filter((holding) => {
      const kind = findInstrument(holding.instrumentId)?.kind;
      return kind !== 'crypto' && kind !== 'penny';
    })
    .reduce((sum, holding) => sum + holdingWorth(book, holding), 0);
  return Math.floor((steady / 100) * PLEDGE_SHARE * 0.01) * 100;
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

export interface HoldingIncome {
  readonly amount: Money;
  readonly source: string;
  /** True when this is a bond's principal coming back, not a payout. */
  readonly matured: boolean;
}

export interface HoldingYear {
  readonly holdings: readonly Holding[];
  /** Dividends, coupons, and any principal returned. */
  readonly income: readonly HoldingIncome[];
  /** Instruments whose bonds reached their date this year. */
  readonly maturedIds: readonly string[];
}

/**
 * What a year of holding pays and what it returns.
 *
 * SEPARATE FROM THE PRICE MOVE, and the split is the point of 0308c's
 * architecture. Prices move for all eighty-nine instruments whether anybody
 * owns them or not (`runPriceYear`); this runs only over what is held, against
 * prices that have ALREADY moved. Doing both in one pass was the old engine's
 * shape and it could not draw a chart for something the player had sold.
 */
export function runHoldingYear(book: PriceBook, holdings: readonly Holding[]): HoldingYear {
  const income: HoldingIncome[] = [];
  const maturedIds: string[] = [];
  const after: Holding[] = [];

  for (const holding of holdings) {
    const instrument = findInstrument(holding.instrumentId);
    if (!instrument) {
      after.push(holding);
      continue;
    }
    const worth = holdingWorth(book, holding);

    if (instrument.payout > 0 && worth > 0) {
      const paid = Math.round(worth * instrument.payout);
      if (paid > 0) {
        income.push({
          amount: cents(paid),
          source: `${instrument.name} — paid out`,
          matured: false,
        });
      }
    }

    /*
      THE DATE ARRIVES. A bond a year closer, and when the clock runs out the
      principal comes back as cash at what it is WORTH — a bond redeemed for its
      original par after ten years would quietly delete every coupon and every
      point of rate movement it earned on the way.
    */
    if (holding.maturesIn !== undefined) {
      const left = holding.maturesIn - 1;
      if (left <= 0) {
        income.push({
          amount: cents(worth),
          source: `${instrument.name} — matured`,
          matured: true,
        });
        maturedIds.push(holding.instrumentId);
        continue;
      }
      after.push({ ...holding, maturesIn: left });
      continue;
    }
    after.push(holding);
  }

  return { holdings: after, income, maturedIds };
}
