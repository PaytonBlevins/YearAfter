/**
 * Ticket 0309 — advisors.
 *
 * Spec 1383: advisors may recommend Buy, Hold, Reduce, Sell and Rebalance,
 * "including crypto", and "better advisors improve quality but never guarantee
 * prediction". That last clause is the whole ticket, and it is a constraint on
 * a number, so the number got measured before anything was designed.
 *
 * WHAT THE MEASUREMENT FOUND, in the order it changed the design.
 *
 * THE OBVIOUS RULE IS HARMFUL. "Recommend what is trading below its trend" is
 * the natural advisor, and measured over 6,000 market years it LOSES to random:
 * a single call goes up 41.9% of the time against 56% for a coin flip. The
 * reason is the interesting part — the naive top six is 94.2% CRYPTO AND PENNY
 * STOCKS, which are the two tiers 0308d exempted from mean reversion by name,
 * because they have no value to revert to. The signal was selecting exactly the
 * names where its own mechanism does not run. Restricted to reverting tiers the
 * same rule returns 11.4% against 6.4% random and beats it 63.7% of the time.
 * Same rule, opposite sign. **CORE_RULES 13.56.**
 *
 * TIERS CANNOT BE BUILT ON A HIDDEN FUNDAMENTAL. The first plan was that a
 * better advisor reads `drift` more accurately. Swept from no skill to perfect
 * skill, the mean year moved 6.3% to 7.4% and the odds of a single call going
 * up stayed pinned at 61% the entire way. Drift spans 0.02-0.082 and volatility
 * spans 0.12-0.95, so across one year the fundamental is a rounding error. A
 * tier built on it would have been a label with nothing behind it.
 *
 * So THE LADDER IS CATEGORICAL: advisors differ in WHAT THEY CAN SEE. The free
 * one makes no forecasts at all and is still worth having, because five of the
 * seven reasons are facts about the portfolio rather than predictions about the
 * market. A bank planner sells you an allocation; a wealth manager sells you
 * picks. The generator asserts the free one cannot forecast.
 *
 * MARKET TIMING IS NOT ADVICE. Buying after a recession year returns -4.5% over
 * the NEXT year even though 0308d measured it at 2.32x over ten. Both are true
 * and the advisor runs on a yearly cadence, so it does not make timing calls —
 * the one thing a player most expects from an advisor is the one thing this
 * market cannot support at this resolution.
 *
 * AND THE TRACK RECORD IS DERIVED, NOT STORED. `howTheyHaveDone` replays what
 * this advisor WOULD have said from the price history already in the save and
 * scores it against what happened. No new save field, no migration, and it
 * cannot flatter itself, because it is the same function that makes today's
 * calls. Being able to watch an advisor be wrong is the honest form of "never
 * guarantees prediction" — better than any disclaimer.
 */

import {
  INSTRUMENTS,
  SECTOR_LABELS,
  findAdvisor,
  findInstrument,
  isPrediction,
  linesForReason,
  type AdviceReason,
  type AdviceVerb,
  type Advisor,
  type Instrument,
  type Sector,
} from '@yearafter/content';
import { priceLine, priceOf, yearChange, type PriceBook } from './market';
import { holdingWorth, type Holding } from './portfolio';

export {
  ADVISORS,
  VERB_LABELS,
  findAdvisor,
  isPrediction,
  type AdviceReason,
  type AdviceVerb,
  type Advisor,
} from '@yearafter/content';

/* -------------------------------------------------------------------------- */
/* The signals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The tiers a `belowTrend` or `aboveTrend` call may name.
 *
 * THIS LINE IS THE TICKET'S MAIN FINDING and it is deliberately not a filter
 * applied later — it is the definition of where the signal is meaningful at
 * all. Crypto and penny stocks are exempt from reversion in `market.ts`, so a
 * reversion-based recommendation about one of them is a claim with no mechanism
 * under it. Measured, making those calls anyway is worse than making none.
 */
const REVERTS = (row: Instrument): boolean => row.kind === 'stock' || row.kind === 'fund';

/**
 * How far below its own trend a name is trading, as a fraction of today's price.
 *
 * Positive means cheap. The anchor is the oldest price on record grown at the
 * instrument's own drift — the same anchor `runPriceYear` pulls toward, which is
 * why this is a real signal rather than a plausible-sounding one.
 */
export function gapToTrend(book: PriceBook, row: Instrument): number {
  const line = priceLine(book, row.id);
  if (line.length < 3) return 0;
  const anchor = line[0]! * (1 + row.drift) ** (line.length - 1);
  const now = priceOf(book, row.id);
  return now > 0 ? (anchor - now) / now : 0;
}

/**
 * The floor under any advisor's `sharpness`, and the bar for the track record.
 *
 * An advisor's own `sharpness` is what they need to make the call; this is the
 * smallest gap the signal is meaningful at, so a future advisor tuned below it
 * is tuned into noise.
 */
const CHEAP_ENOUGH = 0.12;
/** And far enough above trend to be worth trimming, scaled per advisor. */
const DEAR_ENOUGH = 0.22;
/*
  The concentration and speculation bars now live PER ADVISOR, in the catalog —
  see `Advisor.concentratedAt`. They were constants here until the measurement
  showed that the risk rules, not the stock ideas, are what advice is actually
  worth: a free planner matched a paid one pick for pick, and the only lever
  that separated the tiers was how tight a leash they held.
*/
/** Cash past this multiple of the portfolio is money not working. */
const IDLE_MULTIPLE = 1.5;
/** Below this there is no advice to give — a beginner needs a buffer, not a plan. */
const IDLE_FLOOR = 12_000;

/**
 * THE SHARE OF SPARE CASH A SINGLE STOCK IDEA IS ALLOWED TO ASK FOR.
 *
 * The first version of this file left `amount` off the two buy forecasts, which
 * meant a player following the advice put EVERY spare dollar into one name. It
 * measured as a disaster — forty years of that returned 0.95x the plain-fund
 * benchmark for the independent advisor and 0.77x for the dearer one.
 *
 * The picks were fine. The position sizing was the bug, and it is the same bug
 * as 0307's "pay some off" button that spent the entire balance: an
 * instruction that says SOME and moves EVERYTHING. A real advisor says "I'd put
 * some into this", and a third of spare cash is what "some" means.
 *
 * It is also the whole reason a stock idea can be worth taking. A single name
 * has roughly 23% annual scatter against a broad fund's 15%, so swapping a fund
 * for a name is a bad trade even when the name is better — and adding a slice
 * beside the fund is a good one. The size IS the advice.
 */
const SLICE = 0.34;
/** Below this a slice is not worth the row it is printed on. */
const SLICE_FLOOR = 1_000;

/** What a single-name idea asks for, given what is in the account. */
const sliceOf = (cash: number): number =>
  cash < SLICE_FLOOR ? 0 : Math.max(SLICE_FLOOR, Math.round(cash * SLICE));

/* -------------------------------------------------------------------------- */

export interface Recommendation {
  /** Stable within a year, so a screen can key on it. */
  readonly id: string;
  readonly verb: AdviceVerb;
  readonly reason: AdviceReason;
  /** Absent for portfolio-level advice. */
  readonly instrumentId?: string;
  /** The advisor's own words, tokens bound. */
  readonly text: string;
  /** Whole dollars they suggest moving, when the verb takes an amount. */
  readonly amount?: number;
  /** True when this one is a forecast and can simply be wrong. */
  readonly forecast: boolean;
}

export interface AdviceInput {
  readonly prices: PriceBook;
  readonly portfolio: readonly Holding[];
  /** Whole dollars in the bank. */
  readonly cash: number;
  readonly year: number;
  readonly advisorId: string;
}

/**
 * A small stable pick, so an advisor's wording holds still within a year.
 *
 * Same reason the newspaper does it (0308d): a screen that re-renders must not
 * reshuffle, and reaching for the RNG from a screen would make two identical
 * lives diverge on how often somebody opened a menu (CORE_RULES 13.30).
 */
function phrase(reason: AdviceReason, year: number, salt: number): string {
  const lines = linesForReason(reason);
  if (lines.length === 0) return '';
  const mixed = Math.abs(Math.imul(year * 2654435761 + salt * 40503, 0x85ebca6b) >>> 3);
  return lines[mixed % lines.length]!.text;
}

const bind = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(/\{([a-zA-Z]+)\}/g, (whole, key: string) => values[key] ?? whole);

const pct = (fraction: number): string => `${Math.round(Math.abs(fraction) * 100)}%`;
const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/* -------------------------------------------------------------------------- */

/**
 * This year's recommendations from one advisor, best first.
 *
 * FACTS BEFORE FORECASTS, always. A player holding 80% of their money in one
 * sector has a problem that no stock pick can outrun, and an advisor who leads
 * with a buy idea while that sits there is the reference app's evergreen
 * headline in a different costume. The ordering is not cosmetic.
 */
export function recommendationsFor(input: AdviceInput): readonly Recommendation[] {
  const advisor = findAdvisor(input.advisorId);
  if (!advisor) return [];

  const { prices, portfolio, cash, year } = input;
  const can = (reason: AdviceReason): boolean => advisor.reasons.includes(reason);

  const worth = portfolio.reduce((sum, holding) => sum + holdingWorth(prices, holding) / 100, 0);
  const out: Recommendation[] = [];

  /* ---- FACTS -------------------------------------------------------------- */

  if (can('concentrated') && worth > 0) {
    const bySector = new Map<Sector, number>();
    for (const holding of portfolio) {
      const instrument = findInstrument(holding.instrumentId);
      if (!instrument?.sector) continue;
      bySector.set(
        instrument.sector,
        (bySector.get(instrument.sector) ?? 0) + holdingWorth(prices, holding) / 100,
      );
    }
    const worst = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0];
    if (worst && worst[1] / worth >= advisor.concentratedAt && bySector.size > 0) {
      out.push({
        id: `rec.${year}.concentrated`,
        verb: 'rebalance',
        reason: 'concentrated',
        text: bind(phrase('concentrated', year, 1), {
          share: pct(worst[1] / worth),
          sector: SECTOR_LABELS[worst[0]],
        }),
        // Enough to bring the sector back under the line, not all of it.
        amount: Math.round(worst[1] - worth * advisor.concentratedAt),
        forecast: false,
      });
    }
  }

  if (can('noFloor') && worth > 0) {
    const risky = portfolio
      .filter((holding) => {
        const kind = findInstrument(holding.instrumentId)?.kind;
        return kind === 'crypto' || kind === 'penny';
      })
      .reduce((sum, holding) => sum + holdingWorth(prices, holding) / 100, 0);
    if (risky / worth >= advisor.speculativeAt) {
      out.push({
        id: `rec.${year}.noFloor`,
        verb: 'reduce',
        reason: 'noFloor',
        text: bind(phrase('noFloor', year, 2), { share: pct(risky / worth) }),
        amount: Math.round(risky - worth * advisor.speculativeAt),
        forecast: false,
      });
    }
  }

  if (can('idleCash') && cash >= IDLE_FLOOR && cash > worth * IDLE_MULTIPLE) {
    out.push({
      id: `rec.${year}.idleCash`,
      verb: 'buy',
      reason: 'idleCash',
      text: bind(phrase('idleCash', year, 3), { amount: money(cash) }),
      // Keep a year of ordinary life back; invest the rest. Never all of it —
      // 0308b measured what happens to a character with no cash buffer and the
      // answer was a happiness of 20 against 78.
      amount: Math.max(0, Math.round(cash - IDLE_FLOOR)),
      forecast: false,
    });
  }

  /* ---- FORECASTS ---------------------------------------------------------- */

  const held = new Set(portfolio.map((holding) => holding.instrumentId));

  if (can('belowTrend')) {
    const bar = Math.max(CHEAP_ENOUGH, advisor.sharpness);
    const cheap = INSTRUMENTS.filter(REVERTS)
      .map((row) => ({ row, gap: gapToTrend(prices, row) }))
      .filter((row) => row.gap >= bar)
      .sort((a, b) => b.gap - a.gap)[0];
    if (cheap) {
      out.push({
        id: `rec.${year}.below.${cheap.row.id}`,
        verb: 'buy',
        reason: 'belowTrend',
        instrumentId: cheap.row.id,
        text: bind(phrase('belowTrend', year, 4), {
          firm: cheap.row.name,
          gap: pct(cheap.gap),
        }),
        amount: sliceOf(cash),
        forecast: true,
      });
    }
  }

  if (can('aboveTrend')) {
    // Only about something they actually hold. "Trim Halcyon" to somebody who
    // has never owned it is an instruction with nothing to act on.
    const dear = portfolio
      .map((holding) => findInstrument(holding.instrumentId))
      .filter((row): row is Instrument => row !== undefined && REVERTS(row))
      .map((row) => ({ row, gap: -gapToTrend(prices, row) }))
      .filter((row) => row.gap >= Math.max(DEAR_ENOUGH, advisor.sharpness))
      .sort((a, b) => b.gap - a.gap)[0];
    if (dear) {
      const holding = portfolio.find((row) => row.instrumentId === dear.row.id)!;
      out.push({
        id: `rec.${year}.above.${dear.row.id}`,
        verb: 'reduce',
        reason: 'aboveTrend',
        instrumentId: dear.row.id,
        text: bind(phrase('aboveTrend', year, 5), {
          firm: dear.row.name,
          gap: pct(dear.gap),
        }),
        amount: Math.round(holdingWorth(prices, holding) / 100 / 3),
        forecast: true,
      });
    }
  }

  if (can('strongEarner')) {
    const quality = INSTRUMENTS.filter(REVERTS)
      .filter((row) => !held.has(row.id))
      .sort((a, b) => b.drift - a.drift)[0];
    if (quality) {
      out.push({
        id: `rec.${year}.earner.${quality.id}`,
        verb: 'buy',
        reason: 'strongEarner',
        instrumentId: quality.id,
        text: bind(phrase('strongEarner', year, 6), { firm: quality.name }),
        amount: sliceOf(cash),
        forecast: true,
      });
    }
  }

  /*
    NOTHING TO SAY IS A THING TO SAY, and it has to be the honest branch rather
    than a filler row. An advisor who invents a trade every year to look busy is
    the failure mode this whole file is written against — one of the `steady`
    lines says so out loud.
  */
  if (out.length === 0 && can('steady')) {
    out.push({
      id: `rec.${year}.steady`,
      verb: 'hold',
      reason: 'steady',
      text: phrase('steady', year, 7),
      forecast: false,
    });
  }

  return out.slice(0, advisor.picks);
}

/* -------------------------------------------------------------------------- */
/* What the fee costs                                                          */
/* -------------------------------------------------------------------------- */

/** This year's fee in whole dollars, charged on the portfolio at year end. */
export function advisorFee(advisor: Advisor, portfolioDollars: number): number {
  return Math.round((portfolioDollars * advisor.feeBasis) / 10_000) + advisor.flatFee;
}

/** Whether this advisor will take the call at all. */
export function willTakeYou(advisor: Advisor, portfolioDollars: number): boolean {
  return portfolioDollars >= advisor.minimumPortfolio;
}

/* -------------------------------------------------------------------------- */
/* The track record                                                            */
/* -------------------------------------------------------------------------- */

export interface TrackRecord {
  /** Forecasts replayed. Zero when the save has no history yet. */
  readonly calls: number;
  /** How many of them were followed by a year that went the right way. */
  readonly right: number;
  /** The most recent replayed call, for the one line the screen shows. */
  readonly last?: { readonly name: string; readonly worked: boolean; readonly yearsAgo: number };
}

/**
 * How this advisor's forecasts actually turned out.
 *
 * REPLAYED FROM THE PRICE BOOK RATHER THAN STORED. A recommendation is a pure
 * function of prices, so "what would they have said five years ago" is
 * answerable from the history already in the save — truncate the price line to
 * that year, run the same signal, and check what the next year did.
 *
 * Two reasons this is worth the trouble. It needs NO new save field and no
 * migration, and — the one that matters — it cannot flatter the advisor,
 * because it is the same code path that makes today's calls. An advisor you can
 * watch being wrong is the honest form of spec 1383's "never guarantee
 * prediction", and it is better than any disclaimer, because the player
 * discovers it rather than being told.
 *
 * Only FORECASTS are replayed. The portfolio-level advice depends on holdings
 * the save does not keep a history of, and scoring a fact as though it were a
 * prediction would be flattery of a different kind.
 */
export function howTheyHaveDone(prices: PriceBook, advisorId: string): TrackRecord {
  const advisor = findAdvisor(advisorId);
  if (!advisor || !advisor.reasons.some(isPrediction)) return { calls: 0, right: 0 };

  let calls = 0;
  let right = 0;
  let last: TrackRecord['last'];

  // Walk backwards through the history, cutting the book at each past year.
  const depth = Math.max(
    ...INSTRUMENTS.filter(REVERTS).map((row) => priceLine(prices, row.id).length),
    0,
  );
  // Needs three points to compute a trend and one more to score the year after.
  for (let back = depth - 1; back >= 4; back -= 1) {
    const asOf = truncate(prices, back);
    const cheap = INSTRUMENTS.filter(REVERTS)
      .map((row) => ({ row, gap: gapToTrend(asOf, row) }))
      .filter((row) => row.gap >= Math.max(CHEAP_ENOUGH, advisor.sharpness))
      .sort((a, b) => b.gap - a.gap)[0];
    if (!cheap) continue;

    // What the NEXT year did to it.
    const line = priceLine(prices, cheap.row.id);
    const at = line.length - back;
    const before = line[at - 1];
    const after = line[at];
    if (before === undefined || after === undefined || before <= 0) continue;

    const worked = after > before;
    calls += 1;
    if (worked) right += 1;
    if (!last) last = { name: cheap.row.name, worked, yearsAgo: back };
  }

  return { calls, right, ...(last ? { last } : {}) };
}

/** The price book as it stood `back` years ago. */
function truncate(prices: PriceBook, back: number): PriceBook {
  const history: Record<string, readonly number[]> = {};
  for (const [id, line] of Object.entries(prices.history)) {
    const cut = line.slice(0, Math.max(1, line.length - back));
    history[id] = cut.length > 0 ? cut : line.slice(0, 1);
  }
  return { history };
}

/** Today's change for one instrument, for the screen's "and since then" line. */
export const sinceLastYear = (prices: PriceBook, instrumentId: string): number =>
  yearChange(prices, instrumentId);
