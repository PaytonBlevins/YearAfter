/**
 * Ticket 0308c — DOES SPREADING ACTUALLY HELP?
 *
 * The sector correlation is the thing this build does that the reference app
 * only displays, and a mechanic that is only claimed in a comment is a
 * decoration. `market.ts` asserts that holding six technology names is not six
 * decisions; this is where that either holds up or does not.
 *
 * The test is NOT that spreading earns more. It should not: six names across
 * six sectors and six names inside one have roughly the same expected return,
 * because the sector shock is mean-zero. What spreading buys is a NARROWER
 * DISTRIBUTION — a better floor, a worse ceiling, and the same middle. If the
 * concentrated portfolio is not visibly wider, `SECTOR_WEIGHT` is doing nothing
 * and sectors are a heading on a list.
 */

import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, SECTORS, type Sector } from '@yearafter/content';
import { EMPTY_PRICES, priceOf, runPriceYear, SECTOR_WEIGHT } from './market';
import { nextMarketState, type MarketState } from './investments';

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};

/** A cheap deterministic generator, so every run here replays. */
function roller(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const stocksIn = (sector: Sector): string[] =>
  INSTRUMENTS.filter((row) => row.kind === 'stock' && row.sector === sector).map((row) => row.id);

/**
 * EVERY SECTOR GETS A TURN, and that is a correction rather than thoroughness.
 *
 * The first version of this test concentrated in TECHNOLOGY and compared it
 * against a six-sector mix. Technology has the highest drift in the catalog, so
 * the comparison was never about correlation: it was tech against the average,
 * with the correlation somewhere underneath. It passed anyway, because variance
 * drag on the wider portfolio ate the drift advantage and the two medians
 * happened to land close together — two errors cancelling.
 *
 * `REVERSION` reduced the drag, the cancellation stopped, and the median gap
 * went to 24%. Nothing about diversification had changed; the confound had
 * simply stopped being hidden. **CORE_RULES 13.55.**
 *
 * Pooling over all seven sectors makes the concentrated basket's average drift
 * the catalog's average drift, which is what the spread basket already was. Now
 * the only difference between the two sides is whether the six names share a
 * shock.
 */
const CONCENTRATED: readonly string[][] = SECTORS.map((sector) => stocksIn(sector).slice(0, 6));

/**
 * One name per sector, rotated, so the spread side is pooled over as many
 * different baskets as the concentrated side is.
 */
const SPREAD: readonly string[][] = SECTORS.map((_, offset) =>
  SECTORS.slice(0, 6)
    .map((sector: Sector) => stocksIn(sector)[offset % stocksIn(sector).length])
    .filter((id): id is string => id !== undefined),
);

/**
 * Put equal money into each name, run `years` of market, and return what the
 * whole thing is worth relative to what went in.
 */
function outcome(ids: readonly string[], years: number, seed: number): number {
  const roll = roller(seed);
  let prices = EMPTY_PRICES;
  let market: MarketState = 'normal';

  // Equal money into each, in units at the opening price.
  const units = ids.map((id) => 10_000_00 / priceOf(prices, id));
  const started = ids.reduce((sum, id, i) => sum + units[i]! * priceOf(prices, id), 0);

  for (let year = 0; year < years; year += 1) {
    market = nextMarketState(market, roll());
    prices = runPriceYear(
      prices,
      market,
      SECTORS.map(() => roll()),
      INSTRUMENTS.map(() => roll()),
    ).prices;
  }

  const ended = ids.reduce((sum, id, i) => sum + units[i]! * priceOf(prices, id), 0);
  return ended / started;
}

describe('sectors are a correlation, not a heading', () => {
  it('has six names to spread across and six to concentrate in', () => {
    for (const basket of CONCENTRATED) {
      expect(basket).toHaveLength(6);
      // Each concentrated basket really is ONE sector, or the test proves nothing.
      const sectors = new Set(basket.map((id) => INSTRUMENTS.find((row) => row.id === id)?.sector));
      expect(sectors.size).toBe(1);
    }
    for (const basket of SPREAD) {
      expect(basket).toHaveLength(6);
      expect(
        new Set(basket.map((id) => INSTRUMENTS.find((row) => row.id === id)?.sector)).size,
      ).toBe(6);
    }
    // And every basket is a distinct set of names, or pooling proves nothing.
    expect(new Set(CONCENTRATED.flat()).size).toBe(CONCENTRATED.flat().length);
  });

  it('makes a concentrated portfolio visibly wider than a spread one', () => {
    const RUNS = 300;
    const YEARS = 20;
    const narrow: number[] = [];
    const wide: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      // SAME SEED for both, so the broad market and every instrument's own luck
      // are identical between the two portfolios. The only difference is which
      // names are held, which is the only thing this is measuring.
      const seed = run * 2654435761 + 991;
      // Pooled over every sector, so the two sides hold the same average drift
      // and the only thing left between them is the shared shock.
      for (const basket of CONCENTRATED) wide.push(outcome(basket, YEARS, seed));
      for (const basket of SPREAD) narrow.push(outcome(basket, YEARS, seed));
    }

    const band = (xs: number[]) => q(xs, 0.9) - q(xs, 0.1);
    const spreadBand = band(narrow);
    const concentratedBand = band(wide);

    console.log(`\n${RUNS} runs of ${YEARS} years, equal money into six names:`);
    console.log(
      `  spread across six sectors:  p10 ${q(narrow, 0.1).toFixed(2)}x  med ${q(narrow, 0.5).toFixed(2)}x  p90 ${q(narrow, 0.9).toFixed(2)}x  band ${spreadBand.toFixed(2)}`,
    );
    console.log(
      `  all six in one sector:      p10 ${q(wide, 0.1).toFixed(2)}x  med ${q(wide, 0.5).toFixed(2)}x  p90 ${q(wide, 0.9).toFixed(2)}x  band ${concentratedBand.toFixed(2)}`,
    );
    console.log(`  (SECTOR_WEIGHT is ${SECTOR_WEIGHT})`);

    // THE MECHANIC. Concentrating has to widen the outcome, or sectors are a
    // label. Ten per cent is the smallest difference worth calling real.
    expect(concentratedBand).toBeGreaterThan(spreadBand * 1.1);

    // AND IT MUST NOT BE A FREE LUNCH IN EITHER DIRECTION. Spreading buys a
    // floor, not a better expectation — if the medians diverged badly, the
    // correlation would be smuggling in a return difference rather than a risk
    // one, and "diversify" would just be the right answer again.
    const medianGap = Math.abs(q(narrow, 0.5) - q(wide, 0.5)) / q(narrow, 0.5);
    expect(medianGap).toBeLessThan(0.2);
  });

  it('gives the spread portfolio the better floor', () => {
    const RUNS = 300;
    const narrow: number[] = [];
    const wide: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const seed = run * 40503 + 17;
      for (const basket of CONCENTRATED) wide.push(outcome(basket, 20, seed));
      for (const basket of SPREAD) narrow.push(outcome(basket, 20, seed));
    }
    // What diversification is actually FOR: the bad case is less bad.
    expect(q(narrow, 0.1)).toBeGreaterThan(q(wide, 0.1));
  });

  it('makes two names in one sector move together more than two across sectors', () => {
    /*
      THE MECHANIC, MEASURED DIRECTLY, because the portfolio test above cannot
      isolate it.

      Six technology names are not only correlated, they also have higher drift
      and wider spreads than one-per-sector picks — which is why the
      concentrated median comes out ABOVE the spread one (2.54x against 2.06x).
      That gap is a property of the catalog, not of the correlation, and a test
      that could not tell the two apart would pass for the wrong reason.

      Correlation of annual returns is the thing itself: same-sector pairs
      should co-move and cross-sector pairs should not.
    */
    const YEARS = 400;
    const roll = roller(777);
    let prices = EMPTY_PRICES;
    let market: MarketState = 'normal';

    const tech = INSTRUMENTS.filter((row) => row.sector === 'technology').slice(0, 2);
    const other = INSTRUMENTS.find((row) => row.sector === 'consumer')!;
    const watch = [tech[0]!.id, tech[1]!.id, other.id];
    const series: number[][] = [[], [], []];

    for (let year = 0; year < YEARS; year += 1) {
      const before = watch.map((id) => priceOf(prices, id));
      market = nextMarketState(market, roll());
      prices = runPriceYear(
        prices,
        market,
        SECTORS.map(() => roll()),
        INSTRUMENTS.map(() => roll()),
      ).prices;
      watch.forEach((id, i) => {
        const after = priceOf(prices, id);
        series[i]!.push(before[i]! > 0 ? (after - before[i]!) / before[i]! : 0);
      });
    }

    const correlate = (a: readonly number[], b: readonly number[]): number => {
      const n = a.length;
      const ma = a.reduce((s, v) => s + v, 0) / n;
      const mb = b.reduce((s, v) => s + v, 0) / n;
      let top = 0;
      let va = 0;
      let vb = 0;
      for (let i = 0; i < n; i += 1) {
        top += (a[i]! - ma) * (b[i]! - mb);
        va += (a[i]! - ma) ** 2;
        vb += (b[i]! - mb) ** 2;
      }
      return top / Math.sqrt(va * vb);
    };

    const sameSector = correlate(series[0]!, series[1]!);
    const crossSector = correlate(series[0]!, series[2]!);
    console.log(
      `\n  correlation of yearly returns over ${YEARS} years:` +
        `\n    two technology names:      ${sameSector.toFixed(3)}` +
        `\n    technology vs consumer:    ${crossSector.toFixed(3)}`,
    );

    expect(sameSector).toBeGreaterThan(crossSector);
    /*
      A SUBSTANTIAL gap, not a detectable one. The first tuning produced 0.276
      against 0.246 and would have passed any threshold small enough to be
      polite — which is how a mechanic ends up shipped as a decoration. Sharing
      a sector has to be most of what two names have in common.
    */
    expect(sameSector - crossSector).toBeGreaterThan(0.3);
    expect(sameSector).toBeGreaterThan(0.5);
    expect(SECTOR_WEIGHT).toBeGreaterThan(0);
    expect(SECTOR_WEIGHT).toBeLessThan(1);
  });
});
