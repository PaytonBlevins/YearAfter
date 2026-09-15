/**
 * Ticket 0309 — advisors and what they say, as content.
 *
 * Authored by `scripts/generate-advice.py`. Logic depends on `reason` and on
 * the stable ids, never on the text (CORE_RULES 13).
 *
 * THE TAXONOMY IS THE DESIGN. Two of the seven reasons are forecasts and five
 * are statements about what the player is already holding. That split is what
 * lets a free advisor be worth having — everything it says is true whether or
 * not it is any good at predicting anything — and it is what keeps a paid one
 * from becoming an oracle.
 */

import adviceData from '../data/advice.json';

/** Spec 1383's five verbs. `hold` is the one nobody has to press. */
export type AdviceVerb = 'buy' | 'hold' | 'reduce' | 'sell' | 'rebalance';

/**
 * Why a recommendation exists.
 *
 * `belowTrend`, `aboveTrend` and `strongEarner` are PREDICTIONS and are wrong
 * about a third of the time. The rest are facts about the current portfolio and
 * are never wrong, only sometimes unwelcome.
 */
export type AdviceReason =
  | 'belowTrend'
  | 'strongEarner'
  | 'aboveTrend'
  | 'concentrated'
  | 'noFloor'
  | 'idleCash'
  | 'steady';

/** The three reasons an advisor can be wrong about. */
export const PREDICTIONS: readonly AdviceReason[] = ['belowTrend', 'strongEarner', 'aboveTrend'];

export const isPrediction = (reason: AdviceReason): boolean => PREDICTIONS.includes(reason);

export interface AdviceLine {
  readonly id: string;
  readonly reason: AdviceReason;
  readonly verb: AdviceVerb;
  /** May bind `{firm}`, `{gap}`, `{share}`, `{sector}` or `{amount}`, per reason. */
  readonly text: string;
}

export interface Advisor {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Yearly fee in basis points of the portfolio. Zero for the free one. */
  readonly feeBasis: number;
  /** Yearly fee in whole dollars, on top. Zero for all three today. */
  readonly flatFee: number;
  /** Whole dollars of portfolio before they will take the call. */
  readonly minimumPortfolio: number;
  /** Which reasons this one can see at all. The ladder is categorical. */
  readonly reasons: readonly AdviceReason[];
  /** How many recommendations they make in a year. */
  readonly picks: number;
  /**
   * The gap to trend this advisor needs before they will call it.
   *
   * THE LADDER IS THIS NUMBER. Measured, there is exactly one signal in this
   * market that beats random, so a dearer advisor cannot see a DIFFERENT kind
   * of thing — they see the same thing sooner. Zero for the free one, which
   * makes no forecasts at all.
   */
  readonly sharpness: number;
  /**
   * The share of the portfolio one sector may hold before they say something,
   * and the share that may sit in things with no floor.
   *
   * THIS IS WHAT THE TIER ACTUALLY SELLS. Measured across 500 forty-year lives,
   * advice added 31% to a stock-picking player's median and 56% to their floor,
   * and almost all of that came from these two bars rather than from the stock
   * ideas — a free planner matched a paid one on picks. So a dearer advisor is
   * not cleverer, they are stricter.
   */
  readonly concentratedAt: number;
  readonly speculativeAt: number;
}

interface AdviceCatalogFile {
  readonly version: number;
  readonly entries: readonly AdviceLine[];
  readonly advisors: readonly Advisor[];
}

const catalog = adviceData as unknown as AdviceCatalogFile;

export const ADVICE_LINES: readonly AdviceLine[] = catalog.entries;
export const ADVISORS: readonly Advisor[] = catalog.advisors;

export const findAdvisor = (id: string): Advisor | undefined =>
  ADVISORS.find((row) => row.id === id);

export const linesForReason = (reason: AdviceReason): readonly AdviceLine[] =>
  ADVICE_LINES.filter((row) => row.reason === reason);

/** What each verb is called on a button. */
export const VERB_LABELS: Readonly<Record<AdviceVerb, string>> = {
  buy: 'Buy',
  hold: 'Hold',
  reduce: 'Reduce',
  sell: 'Sell',
  rebalance: 'Rebalance',
};
