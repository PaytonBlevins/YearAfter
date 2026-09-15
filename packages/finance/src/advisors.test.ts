/**
 * Ticket 0309 — the advisor, checked against the claims made for it.
 *
 * The dangerous failure here is not a crash, it is an ORACLE: a recommendation
 * engine good enough that doing what it says is always right collapses the
 * investment screen into one button and makes 0308c's eighty-nine instruments
 * scenery. Spec 1383 forbids it — "never guarantee prediction" — and a
 * disclaimer does not enforce anything.
 *
 * So these tests are about the shape of the advice rather than its existence:
 * that facts come before forecasts, that a forecast is sometimes wrong, that
 * the free advisor cannot forecast at all, and that the track record can report
 * a failure.
 */

import { describe, expect, it } from 'vitest';
import {
  ADVICE_LINES,
  ADVISORS,
  INSTRUMENTS,
  SECTORS,
  instrumentsOfKind,
  isPrediction,
  type AdviceReason,
} from '@yearafter/content';
import { cents } from '@yearafter/core';
import {
  advisorFee,
  gapToTrend,
  howTheyHaveDone,
  recommendationsFor,
  willTakeYou,
} from './advisors';
import { openingPrices, priceOf, runPriceYear, type PriceBook } from './market';
import { nextMarketState, type MarketState } from './investments';
import type { Holding } from './portfolio';

function roller(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function bookAfter(years: number, seed: number): PriceBook {
  const roll = roller(seed);
  let book = openingPrices();
  let market: MarketState = 'normal';
  for (let year = 0; year < years; year += 1) {
    book = runPriceYear(
      book,
      market,
      SECTORS.map(() => roll()),
      INSTRUMENTS.map(() => roll()),
    ).prices;
    market = nextMarketState(market, roll());
  }
  return book;
}

const FREE = ADVISORS.find((row) => row.feeBasis === 0)!;
const PAID = ADVISORS.find((row) => row.feeBasis > 0)!;

const holdingOf = (id: string, units: number, paid: number): Holding => ({
  instrumentId: id,
  units,
  paid: cents(paid * 100),
});

describe('the ladder', () => {
  it('has at least two rungs and orders them by fee', () => {
    expect(ADVISORS.length).toBeGreaterThanOrEqual(2);
    const fees = ADVISORS.map((row) => row.feeBasis);
    expect(fees).toEqual([...fees].sort((a, b) => a - b));
  });

  it('keeps the free one out of the forecasting business', () => {
    /*
      THE LOAD-BEARING CONSTRAINT. Five of the seven reasons are facts about the
      portfolio and two are predictions; a free advisor that could forecast
      would make every paid one pointless, and a free advisor that could not say
      anything useful would make itself pointless. The generator asserts this
      too — it is here as well because the generator guards the catalog and this
      guards the code that reads it.
    */
    for (const reason of FREE.reasons) {
      expect(isPrediction(reason), `${FREE.id} can say ${reason}`).toBe(false);
    }
    expect(FREE.sharpness).toBe(0);
    expect(PAID.reasons.some(isPrediction)).toBe(true);
  });

  it('charges what it says it charges', () => {
    expect(advisorFee(FREE, 1_000_000)).toBe(0);
    // 20 basis points of a million is two thousand, and a fee that drifted from
    // its own label would be the "said some, spent everything" defect again.
    expect(advisorFee(PAID, 1_000_000)).toBe(Math.round((1_000_000 * PAID.feeBasis) / 10_000));
  });

  it('turns away somebody under the minimum', () => {
    expect(willTakeYou(FREE, 0)).toBe(true);
    if (PAID.minimumPortfolio > 0) {
      expect(willTakeYou(PAID, PAID.minimumPortfolio - 1)).toBe(false);
      expect(willTakeYou(PAID, PAID.minimumPortfolio)).toBe(true);
    }
  });
});

describe('what they say', () => {
  const prices = bookAfter(10, 4242);

  it('never renders a token it could not bind', () => {
    for (let year = 2000; year < 2060; year += 1) {
      for (const advisor of ADVISORS) {
        const recs = recommendationsFor({
          prices,
          portfolio: [],
          cash: 250_000,
          year,
          advisorId: advisor.id,
        });
        for (const rec of recs) {
          expect(rec.text, `${advisor.id} ${year}: ${rec.text}`).not.toMatch(/[{}]/);
          expect(rec.text.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('puts facts before forecasts', () => {
    /*
      A player with 80% of their money in one sector has a problem no stock pick
      can outrun. An advisor who leads with a buy idea while that sits there is
      the reference app's evergreen headline in a different costume, so the
      ordering is a rule rather than a preference.
    */
    const tech = INSTRUMENTS.filter((row) => row.sector === 'technology').slice(0, 3);
    const portfolio = tech.map((row) => holdingOf(row.id, 500, 40_000));
    const recs = recommendationsFor({
      prices,
      portfolio,
      cash: 400_000,
      year: 2033,
      advisorId: PAID.id,
    });
    const firstForecast = recs.findIndex((rec) => rec.forecast);
    const lastFact = recs.map((rec) => rec.forecast).lastIndexOf(false);
    if (firstForecast >= 0 && lastFact >= 0) {
      expect(lastFact, recs.map((r) => `${r.reason}:${r.forecast}`).join(' ')).toBeLessThan(
        firstForecast,
      );
    }
  });

  it('notices a portfolio that is all one sector', () => {
    const tech = INSTRUMENTS.filter((row) => row.sector === 'technology').slice(0, 3);
    const recs = recommendationsFor({
      prices,
      portfolio: tech.map((row) => holdingOf(row.id, 500, 40_000)),
      cash: 0,
      year: 2035,
      advisorId: FREE.id,
    });
    expect(recs.some((rec) => rec.reason === 'concentrated')).toBe(true);
    const rec = recs.find((rec) => rec.reason === 'concentrated')!;
    expect(rec.verb).toBe('rebalance');
    expect(rec.forecast).toBe(false);
    expect(rec.amount ?? 0).toBeGreaterThan(0);
  });

  it('notices a portfolio that is mostly things with no floor', () => {
    const coins = instrumentsOfKind('crypto').slice(0, 2);
    const recs = recommendationsFor({
      prices,
      portfolio: coins.map((row) => holdingOf(row.id, 20, 5_000)),
      cash: 0,
      year: 2036,
      advisorId: FREE.id,
    });
    expect(recs.some((rec) => rec.reason === 'noFloor')).toBe(true);
  });

  it('notices money sitting in the bank', () => {
    const recs = recommendationsFor({
      prices,
      portfolio: [],
      cash: 300_000,
      year: 2037,
      advisorId: FREE.id,
    });
    const idle = recs.find((rec) => rec.reason === 'idleCash');
    expect(idle).toBeDefined();
    // NEVER ALL OF IT. 0308b measured what happens to a character with no cash
    // buffer: happiness 20 against 78, because thirty-four stress-relieving
    // events are gated on having some.
    expect(idle!.amount!).toBeLessThan(300_000);
    expect(idle!.amount!).toBeGreaterThan(0);
  });

  it('says something rather than nothing when there is nothing to say', () => {
    // A single modest fund and no spare cash: no fact fires, and a screen with
    // an empty list reads as broken rather than calm.
    const fund = instrumentsOfKind('fund')[0]!;
    const recs = recommendationsFor({
      prices,
      portfolio: [holdingOf(fund.id, 40, 10_000)],
      cash: 200,
      year: 2038,
      advisorId: FREE.id,
    });
    expect(recs.length).toBeGreaterThan(0);
  });

  it('never names a coin or a penny stock in a trend call', () => {
    /*
      THE TICKET'S MAIN FINDING, as a test. Crypto and penny stocks are exempt
      from mean reversion in `market.ts`, so a reversion-based call about one of
      them is a claim with no mechanism under it — measured, making those calls
      anyway is WORSE than making none: a single call went up 41.9% of the time
      against 56% for a coin flip.
    */
    const loose = new Set(
      INSTRUMENTS.filter((row) => row.kind === 'crypto' || row.kind === 'penny').map(
        (row) => row.id,
      ),
    );
    for (let seed = 1; seed < 25; seed += 1) {
      const book = bookAfter(11, seed * 37);
      for (let year = 2000; year < 2010; year += 1) {
        const recs = recommendationsFor({
          prices: book,
          portfolio: INSTRUMENTS.filter((row) => loose.has(row.id))
            .slice(0, 3)
            .map((row) => holdingOf(row.id, 100, 2_000)),
          cash: 50_000,
          year,
          advisorId: PAID.id,
        });
        for (const rec of recs) {
          if (rec.reason !== 'belowTrend' && rec.reason !== 'aboveTrend') continue;
          expect(loose.has(rec.instrumentId ?? ''), `${rec.reason} named ${rec.instrumentId}`).toBe(
            false,
          );
        }
      }
    }
  });

  it('holds still within a year and moves between years', () => {
    const once = recommendationsFor({
      prices,
      portfolio: [],
      cash: 300_000,
      year: 2040,
      advisorId: PAID.id,
    });
    const twice = recommendationsFor({
      prices,
      portfolio: [],
      cash: 300_000,
      year: 2040,
      advisorId: PAID.id,
    });
    expect(twice).toEqual(once);

    const wordings = new Set<string>();
    for (let year = 2000; year < 2050; year += 1) {
      const recs = recommendationsFor({
        prices,
        portfolio: [],
        cash: 300_000,
        year,
        advisorId: PAID.id,
      });
      const idle = recs.find((rec) => rec.reason === 'idleCash');
      if (idle) wordings.add(idle.text);
    }
    // CORE_RULES 13.17: a player reads this for fifty years.
    expect(wordings.size).toBeGreaterThan(3);
  });

  it('never makes more calls than it claims to', () => {
    for (const advisor of ADVISORS) {
      const tech = INSTRUMENTS.filter((row) => row.sector === 'technology').slice(0, 3);
      const coins = instrumentsOfKind('crypto').slice(0, 2);
      const recs = recommendationsFor({
        prices,
        portfolio: [
          ...tech.map((row) => holdingOf(row.id, 400, 40_000)),
          ...coins.map((row) => holdingOf(row.id, 30, 9_000)),
        ],
        cash: 900_000,
        year: 2041,
        advisorId: advisor.id,
      });
      expect(recs.length, advisor.id).toBeLessThanOrEqual(advisor.picks);
      for (const rec of recs) {
        expect(advisor.reasons.includes(rec.reason), `${advisor.id} said ${rec.reason}`).toBe(true);
      }
    }
  });

  it('says nothing at all for an advisor who does not exist', () => {
    expect(
      recommendationsFor({ prices, portfolio: [], cash: 1_000, year: 2042, advisorId: 'nope' }),
    ).toEqual([]);
  });
});

describe('the track record', () => {
  it('is empty for an advisor who cannot forecast', () => {
    expect(howTheyHaveDone(bookAfter(12, 9), FREE.id).calls).toBe(0);
  });

  it('reports both hits and misses across enough histories', () => {
    /*
      THE POINT OF THE WHOLE FEATURE. If the replay could only ever report
      successes it would be an advertisement, not a record — and spec 1383's
      "never guarantee prediction" would be a line of copy with nothing behind
      it. Across enough saves it has to be able to say both.
    */
    let anyWrong = false;
    let anyRight = false;
    let sawCalls = false;
    for (let seed = 1; seed < 60; seed += 1) {
      const record = howTheyHaveDone(bookAfter(12, seed * 101), PAID.id);
      if (record.calls === 0) continue;
      sawCalls = true;
      expect(record.right).toBeLessThanOrEqual(record.calls);
      if (record.right < record.calls) anyWrong = true;
      if (record.right > 0) anyRight = true;
    }
    expect(sawCalls, 'no history ever produced a single call to score').toBe(true);
    expect(anyRight, 'this advisor was never right about anything').toBe(true);
    expect(anyWrong, 'this advisor was never wrong, which makes it an oracle').toBe(true);
  });

  it('has nothing to replay from a save with no history', () => {
    expect(howTheyHaveDone(openingPrices(), PAID.id).calls).toBe(0);
  });
});

describe('the signal underneath', () => {
  it('reads zero when there is no history to read', () => {
    const fresh = openingPrices();
    for (const row of INSTRUMENTS.slice(0, 10)) {
      expect(gapToTrend(fresh, row)).toBe(0);
    }
  });

  it('calls a price below its own trend cheap, and above it dear', () => {
    const row = INSTRUMENTS.find((r) => r.kind === 'stock')!;
    const flat = Array.from({ length: 10 }, () => row.priceCents);
    const fallen: PriceBook = {
      history: { [row.id]: [...flat, Math.round(row.priceCents * 0.5)] },
    };
    const risen: PriceBook = {
      history: { [row.id]: [...flat, Math.round(row.priceCents * 2)] },
    };
    expect(gapToTrend(fallen, row)).toBeGreaterThan(0);
    expect(gapToTrend(risen, row)).toBeLessThan(0);
    expect(priceOf(fallen, row.id)).toBeLessThan(priceOf(risen, row.id));
  });
});

describe('the catalog behind it', () => {
  it('has a reader for every reason it carries lines for', () => {
    const read = new Set<AdviceReason>(ADVISORS.flatMap((row) => row.reasons));
    const written = new Set(ADVICE_LINES.map((row) => row.reason));
    for (const reason of written) {
      expect(read.has(reason), `${reason} has lines and no advisor who can say them`).toBe(true);
    }
  });

  it('gives every reason enough lines not to repeat inside a decade', () => {
    const counts = new Map<AdviceReason, number>();
    for (const line of ADVICE_LINES) {
      counts.set(line.reason, (counts.get(line.reason) ?? 0) + 1);
    }
    for (const [reason, count] of counts) {
      expect(count, reason).toBeGreaterThanOrEqual(6);
    }
  });
});
