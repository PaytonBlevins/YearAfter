/**
 * Ticket 0308 / 0308c — the market's weather.
 *
 * This file used to be the whole investment engine: seven PRODUCTS, each a
 * category with a drift and a spread, and a portfolio that was a dollar blob
 * with a growth rate. 0308c replaced that with a real catalog — see
 * `@yearafter/content`'s `instruments.ts` for the eighty-nine named things,
 * `market.ts` for their prices, and `portfolio.ts` for holding them in units.
 *
 * What is left here is the one piece that was right from the start: the broad
 * market state, which every instrument is pulled by and none of them owns.
 *
 * SPEC 1222'S SIX STATES, AND THIS IS STILL NOT THE ECONOMY TICKET.
 *
 * Spec 706-724 wants a backend economy — expansion through severe recession,
 * severe ones "exceptionally rare", effects "moderate rather than constantly
 * punitive" — influencing employment, property, business AND investments. It is
 * unticketed. The state lives here, drives only investments, and is shaped so
 * that the economy ticket DRIVES it rather than replaces it: `nextMarketState`
 * is pure and takes its roll, so a world economy can hand it one instead.
 *
 * TWO RULES CAME OUT OF THIS SYSTEM AND BOTH ARE WORTH KNOWING BEFORE EDITING
 * ANYTHING HERE.
 *
 * CORE_RULES 13.50 — waiting is free in this build, so no instrument that BUYS
 * time can be worth its interest. 0308b's bond maturities are the first
 * exception: money inside a bond is genuinely away until a date.
 *
 * CORE_RULES 13.52/13.53 — the first version of this engine was designed around
 * a liquidity trap that did not exist, and the measurement that "proved" it
 * watched two signals which were zero by construction. What actually punishes a
 * character for holding no cash is event gating: `cashAtLeast` locks them out of
 * thirty-four stress-relieving events, so stress accumulates and happiness
 * falls. Median 78 against 20. Nobody designed that as a floor and it is a good
 * one.
 */

/* -------------------------------------------------------------------------- */
/* What is not built yet                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Same device as `UNWRITTEN_CATEGORIES` and `NOT_YET_OWNED`, with the guard
 * CORE_RULES 13.51 added: a test asserts both the contents AND that nothing is
 * still waiting on a ticket that has already shipped.
 */
export const INVESTMENTS_NOT_YET_BUILT = [
  { key: 'retirement', label: 'Retirement accounts', needs: 'an employer match', arrives: '0310' },
  { key: 'private', label: 'Private deals', needs: 'a business to invest in', arrives: '0605' },
] as const;

/* -------------------------------------------------------------------------- */
/* The broad market                                                            */
/* -------------------------------------------------------------------------- */

/** Spec 1222's six, worst to best so comparisons read naturally. */
export const MARKET_STATES = [
  'severeRecession',
  'recession',
  'slowdown',
  'normal',
  'growth',
  'strongExpansion',
] as const;

export type MarketState = (typeof MARKET_STATES)[number];

/**
 * How long a state tends to last.
 *
 * Spec 1222 wants severe recessions "exceptionally rare": one can only be
 * entered from an ordinary recession, and it is the single state in this table
 * that cannot follow itself. Measured over 200,000 years the mix comes out at
 * 0.47% severe, 8.1% recession, 20.4% slowdown, 38.7% normal, 24.7% growth,
 * 7.7% boom — which is roughly one crash in a lifetime and sometimes none.
 *
 * Written as weights rather than probabilities so a row can be edited without
 * re-normalising the rest of the table by hand.
 */
const TRANSITIONS: Readonly<Record<MarketState, Readonly<Partial<Record<MarketState, number>>>>> = {
  severeRecession: { recession: 45, slowdown: 35, normal: 20 },
  recession: { severeRecession: 6, recession: 28, slowdown: 40, normal: 26 },
  slowdown: { recession: 16, slowdown: 30, normal: 42, growth: 12 },
  normal: { recession: 6, slowdown: 16, normal: 46, growth: 26, strongExpansion: 6 },
  growth: { slowdown: 14, normal: 32, growth: 38, strongExpansion: 16 },
  strongExpansion: { slowdown: 16, normal: 30, growth: 36, strongExpansion: 18 },
};

/** Next year's market, from this year's and one roll in [0,1). */
export function nextMarketState(current: MarketState, roll: number): MarketState {
  const row = TRANSITIONS[current];
  const total = Object.values(row).reduce((sum, weight) => sum + (weight ?? 0), 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const state of MARKET_STATES) {
    const weight = row[state] ?? 0;
    if (weight <= 0) continue;
    cursor -= weight;
    if (cursor < 0) return state;
  }
  return 'normal';
}

/** Where a life starts. Not the best state, not the worst, and not random. */
export const OPENING_MARKET: MarketState = 'normal';

/**
 * What to call a year, in the one sentence the screen gets.
 *
 * Spec 706-724 forbids an economy dashboard. A phrase on the screen the effect
 * lands on is the contextual version of the same information.
 */
export const MARKET_LABELS: Readonly<Record<MarketState, string>> = {
  severeRecession: 'a crash',
  recession: 'a recession',
  slowdown: 'a slowdown',
  normal: 'an ordinary year',
  growth: 'a good year',
  strongExpansion: 'a boom',
};
