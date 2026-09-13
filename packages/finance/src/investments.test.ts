/**
 * Ticket 0308 acceptance tests — the investment engine.
 *
 * Three things worth asserting, and the middle one is the ticket:
 *   the ACCOUNTING, because spec 44-46 is easy to get subtly wrong;
 *   the LADDER, because a risk ladder whose risky asset has the better floor
 *     is not a ladder, it is a right answer with decorations;
 *   the BOUNDS, because this build has already compounded $200 into $1.28bn
 *     once and nobody noticed until a population was run for sixty years.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  CLASS_LABELS,
  INVESTMENTS_NOT_YET_BUILT,
  INVESTMENT_PRODUCTS,
  MARKET_STATES,
  MAX_HOLDINGS,
  PLEDGEABLE_FROM,
  PLEDGE_SHARE,
  buyInto,
  canBuy,
  findInvestment,
  holdingValue,
  nextMarketState,
  pledgeableAgainst,
  portfolioGain,
  runMarketYear,
  sellFrom,
  type AssetClass,
  type Holding,
  type MarketState,
} from './investments';
import { TICKET, stillAhead } from './summary';

const hold = (productId: string, contributed: number, value = contributed): Holding => ({
  productId,
  contributed: dollars(contributed),
  value: dollars(value),
});

/** A cheap deterministic generator so every run here replays identically. */
function roller(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

describe('the four classes spec 1691 names, and no fifth', () => {
  it('covers stocks, funds, bonds and crypto', () => {
    const classes = new Set(INVESTMENT_PRODUCTS.map((product) => product.assetClass));
    expect([...classes].sort()).toEqual(['bonds', 'crypto', 'funds', 'stocks']);
    for (const key of Object.keys(CLASS_LABELS) as AssetClass[]) {
      expect(
        INVESTMENT_PRODUCTS.some((product) => product.assetClass === key),
        key,
      ).toBe(true);
    }
  });

  it('orders the catalog safest to wildest, because the screen is read downwards', () => {
    // The same lesson 0307's refusal column learned by shipping five identical
    // sentences: when a list IS a ladder, its order is information.
    const spreads = INVESTMENT_PRODUCTS.map((product) => product.spread);
    expect(spreads).toEqual([...spreads].sort((a, b) => a - b));
  });

  it('names what is not built, and nothing waits on a ticket that has shipped', () => {
    expect(INVESTMENTS_NOT_YET_BUILT.map((row) => row.key)).toEqual(['retirement', 'private']);
    for (const row of INVESTMENTS_NOT_YET_BUILT) {
      expect(
        stillAhead(row.arrives),
        `${row.key} claims to arrive in ${row.arrives}, which is not ahead of ${TICKET}`,
      ).toBe(true);
    }
  });
});

describe('spec 44-46 — buying is a transfer, and makes nobody poorer', () => {
  it('leaves the money in the portfolio, to the cent', () => {
    const after = buyInto([], 'inv.indexfund', 10_000);
    expect(Number(holdingValue(after))).toBe(1_000_000);
    expect(portfolioGain(after)).toBe(0);
  });

  it('adds to a position rather than opening a second row for it', () => {
    const twice = buyInto(buyInto([], 'inv.indexfund', 10_000), 'inv.indexfund', 5_000);
    expect(twice).toHaveLength(1);
    expect(Number(holdingValue(twice))).toBe(1_500_000);
  });

  it('applies a minimum to OPENING a position and not to adding to one', () => {
    /*
      The rule misfiring on the person it exists for, which is the shape of
      every reachability defect in this build (13.16). Somebody who already
      holds $8,000 of an index fund and puts in another $200 is not opening an
      account, and refusing them would be the minimum doing the opposite of its
      job.
    */
    const fund = findInvestment('inv.managedfund')!;
    expect(canBuy([], fund, 200, 100_000)).toBe('belowMinimum');
    const held = buyInto([], fund.id, fund.minimum);
    expect(canBuy(held, fund, 200, 100_000)).toBeUndefined();
  });

  it('refuses to spend money that is not there', () => {
    expect(canBuy([], findInvestment('inv.indexfund')!, 10_000, 500)).toBe('noCash');
  });

  it('stops a portfolio becoming a list', () => {
    let holdings: readonly Holding[] = [];
    for (const product of INVESTMENT_PRODUCTS.slice(0, MAX_HOLDINGS)) {
      holdings = buyInto(holdings, product.id, product.minimum);
    }
    expect(holdings.length).toBe(Math.min(MAX_HOLDINGS, INVESTMENT_PRODUCTS.length));
  });
});

describe('selling', () => {
  it('takes the contribution off pro rata, so a gain stays honest afterwards', () => {
    /*
      A $10,000 holding now worth $20,000 is up $10,000. Sell half and the
      remainder is $10,000 of value against $5,000 put in — still up $5,000.
      Taking the sale off the CONTRIBUTION first would leave a half-sold winner
      claiming it had doubled again; taking it off VALUE only would leave it
      claiming a gain it had already banked.
    */
    const held = [hold('inv.indexfund', 10_000, 20_000)];
    const sale = sellFrom(held, 'inv.indexfund', 10_000);
    expect(sale.raised).toBe(10_000);
    expect(sale.realized).toBe(5_000);
    expect(portfolioGain(sale.holdings)).toBe(5_000);
  });

  it('drops a position sold out entirely rather than keeping a zero row', () => {
    const sale = sellFrom([hold('inv.crypto', 1_000, 400)], 'inv.crypto', 5_000);
    expect(sale.holdings).toHaveLength(0);
    // And reports the loss honestly: $400 back on $1,000 in.
    expect(sale.raised).toBe(400);
    expect(sale.realized).toBe(-600);
  });

  it('cannot sell more than is there', () => {
    const sale = sellFrom([hold('inv.indexfund', 5_000)], 'inv.indexfund', 999_999);
    expect(sale.raised).toBe(5_000);
    expect(sale.holdings).toHaveLength(0);
  });
});

describe('the market', () => {
  it('keeps severe recessions exceptionally rare, as spec 1222 requires', () => {
    const roll = roller(7);
    let state: MarketState = 'normal';
    const seen: Record<string, number> = {};
    const N = 200_000;
    for (let i = 0; i < N; i += 1) {
      state = nextMarketState(state, roll());
      seen[state] = (seen[state] ?? 0) + 1;
    }
    const share = (key: MarketState) => (seen[key] ?? 0) / N;
    // "Exceptionally rare" — about one year in two hundred, which is roughly
    // one crash in a lifetime and sometimes none at all.
    expect(share('severeRecession')).toBeLessThan(0.015);
    expect(share('severeRecession')).toBeGreaterThan(0);
    // And "moderate rather than constantly punitive": ordinary or better is
    // most of anybody's life.
    expect(share('normal') + share('growth') + share('strongExpansion')).toBeGreaterThan(0.6);
    for (const key of MARKET_STATES) expect(share(key), key).toBeGreaterThan(0);
  });

  it('never lets a crash follow a crash', () => {
    // The one place in the transition table where a state cannot repeat, which
    // is what "exceptionally rare" has to mean for the worst one.
    for (let i = 0; i < 1_000; i += 1) {
      expect(nextMarketState('severeRecession', i / 1_000)).not.toBe('severeRecession');
    }
  });
});

describe('a year of holding', () => {
  it('pays a bond coupon in CASH and a growth share nothing', () => {
    // What makes bonds a different decision rather than a worse one.
    const bonds = runMarketYear([hold('inv.govbonds', 100_000)], 'normal', [0.5]);
    expect(bonds.income).toHaveLength(1);
    expect(Number(bonds.income[0]?.amount)).toBeGreaterThan(0);

    const growth = runMarketYear([hold('inv.growth', 100_000)], 'normal', [0.5]);
    expect(growth.income).toHaveLength(0);
  });

  it('moves the whole portfolio down in a crash and up in a boom', () => {
    const holdings = [hold('inv.indexfund', 100_000)];
    const crash = runMarketYear(holdings, 'severeRecession', [0.5]);
    const boom = runMarketYear(holdings, 'strongExpansion', [0.5]);
    expect(crash.moved).toBeLessThan(0);
    expect(boom.moved).toBeGreaterThan(0);
    expect(Number(boom.holdings[0]?.value)).toBeGreaterThan(Number(crash.holdings[0]?.value));
  });

  it('barely moves a government bond, whatever the market does', () => {
    // The floor of the ladder has to actually be a floor.
    const holdings = [hold('inv.govbonds', 100_000)];
    for (const state of MARKET_STATES) {
      for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
        const year = runMarketYear(holdings, state, [roll]);
        expect(Math.abs(year.moved), `${state} @ ${roll}`).toBeLessThan(0.12);
      }
    }
  });

  it('never takes a holding below zero, however bad the year', () => {
    /*
      Not decoration. Crypto's spread puts a -1.4 draw inside reach, and a
      negative value would put a negative asset on a net-worth line and break
      0302's reconciliation in the same stroke.
    */
    for (const product of INVESTMENT_PRODUCTS) {
      for (const roll of [0, 0.0001, 0.001]) {
        const year = runMarketYear([hold(product.id, 10_000)], 'severeRecession', [roll]);
        expect(Number(year.holdings[0]?.value), `${product.id} @ ${roll}`).toBeGreaterThan(0);
      }
    }
  });

  it('bounds what a single year can compound into the next one', () => {
    /*
      THE 0306 DEFECT, PREVENTED AT BIRTH FOR THE SECOND TICKET RUNNING. A
      frozen card compounded $200 into $1.28bn across a working life because
      nothing bounded the recurrence. Crypto in a boom with a good draw computes
      to +139% before the clamp, and a handful of those stacked across fifty
      years is the same shape.
    */
    for (const product of INVESTMENT_PRODUCTS) {
      for (const roll of [0.9999, 0.999, 0.99]) {
        const year = runMarketYear([hold(product.id, 10_000)], 'strongExpansion', [roll]);
        expect(
          Number(year.holdings[0]?.value) / 100,
          `${product.id} @ ${roll}`,
        ).toBeLessThanOrEqual(10_000 * 2.2 + 1);
      }
    }
  });

  it('leaves an empty portfolio alone and reports no movement', () => {
    const year = runMarketYear([], 'severeRecession', []);
    expect(year.holdings).toHaveLength(0);
    expect(year.moved).toBe(0);
    expect(year.income).toHaveLength(0);
  });
});

describe('what a private bank will lend against — Ticket 0308', () => {
  it('lends against nothing below the floor', () => {
    expect(pledgeableAgainst([hold('inv.indexfund', PLEDGEABLE_FROM - 1_000)])).toBe(0);
  });

  it('lends a share of a real portfolio', () => {
    const pledge = pledgeableAgainst([hold('inv.indexfund', 200_000)]);
    expect(pledge).toBeCloseTo(200_000 * PLEDGE_SHARE, -2);
  });

  it('will not take crypto as collateral', () => {
    /*
      A bank lending against something that can halve inside a year is not
      running a product, it is running the bank's problem. The floor still
      counts the whole portfolio — they will look at somebody with $100,000 —
      but only the steady part is pledgeable.
    */
    const mixed = [hold('inv.indexfund', 100_000), hold('inv.crypto', 100_000)];
    expect(pledgeableAgainst(mixed)).toBeCloseTo(100_000 * PLEDGE_SHARE, -2);
    expect(pledgeableAgainst([hold('inv.crypto', 200_000)])).toBe(0);
  });
});
