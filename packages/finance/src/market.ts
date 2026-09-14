/**
 * Ticket 0308c — live prices, price history, and sectors that move together.
 *
 * 0308 moved a portfolio as one blob: every holding got its own independent
 * shock and that was the whole model. This is the layer that makes a market out
 * of it, and the piece that matters most is the middle one:
 *
 *   A PRICE PER INSTRUMENT, carried in the save and moved once a year, so a
 *   player can recognise a number and watch it change.
 *
 *   A SECTOR SHOCK SHARED BY EVERYTHING IN A SECTOR. The reference app shows
 *   sectors on its market list; as far as its behaviour reveals, they are a
 *   heading. Here they are a correlation: holding six technology names is not
 *   six decisions, and `diversification.test.ts` measures whether that is
 *   actually true rather than asserting it.
 *
 *   A ROLLING HISTORY, because a chart of where a price has been is the single
 *   most engaging thing on an investment screen and it cannot be drawn from a
 *   number with no past.
 *
 * WHAT THIS DELIBERATELY IS NOT. Prices here are NOT derived from anything a
 * real market does — there is no order book, no volume, no liquidity. A year is
 * the unit of time in this game and a year of a share price is one number. Spec
 * 706-724 forbids an economy dashboard and wants market conditions surfaced
 * only where they land; this file is the "where they land" for investments.
 */

import { findInstrument, INSTRUMENTS, type Instrument, type Sector } from '@yearafter/content';
import type { MarketState } from './investments';

/*
  RE-EXPORTED ON PURPOSE, as a facade rather than a convenience.

  A price is meaningless without the instrument it belongs to, so anything that
  can read this package's prices needs the catalog too. Re-exporting the lookup
  here means `@yearafter/persistence` and the rest do not each have to take a
  dependency on `@yearafter/content` to ask what `bd.cald10` is — one edge in
  the graph instead of five, and one fewer install for anybody pulling the repo.
*/
export {
  BOND_ISSUERS,
  INSTRUMENTS,
  KIND_LABELS,
  SECTORS,
  SECTOR_LABELS,
  findInstrument,
  instrumentsInSector,
  instrumentsOfKind,
  type Instrument,
  type InstrumentKind,
  type Sector,
} from '@yearafter/content';

/**
 * How many years of price a save carries per instrument.
 *
 * Twelve, so a ten-year chart has headroom and a save does not grow without
 * bound. The whole catalog at this depth is roughly a thousand integers, which
 * is small beside the transaction ledger a full life already stores.
 */
export const HISTORY_YEARS = 12;

/**
 * Every instrument's price history, oldest first. The last entry is today.
 *
 * Keyed by instrument id and stored as whole cents, like every other amount in
 * this build. A missing key means "never moved" and reads as the catalog's
 * opening price, so a save written before an instrument was added still loads.
 */
export interface PriceBook {
  readonly history: Readonly<Record<string, readonly number[]>>;
}

export const EMPTY_PRICES: PriceBook = { history: {} };

/** Today's price for one instrument, in cents. */
export function priceOf(book: PriceBook, instrumentId: string): number {
  const line = book.history[instrumentId];
  if (line && line.length > 0) return line[line.length - 1]!;
  return findInstrument(instrumentId)?.priceCents ?? 0;
}

/** What it was a year ago, for the market list's up-or-down. */
export function previousPrice(book: PriceBook, instrumentId: string): number {
  const line = book.history[instrumentId];
  if (line && line.length > 1) return line[line.length - 2]!;
  return priceOf(book, instrumentId);
}

/** The price line for a chart, oldest first. Always at least one point. */
export function priceLine(book: PriceBook, instrumentId: string): readonly number[] {
  const line = book.history[instrumentId];
  if (line && line.length > 0) return line;
  return [findInstrument(instrumentId)?.priceCents ?? 0];
}

/** Change over the last year, as a fraction. Zero when there is no history. */
export function yearChange(book: PriceBook, instrumentId: string): number {
  const now = priceOf(book, instrumentId);
  const before = previousPrice(book, instrumentId);
  return before > 0 ? (now - before) / before : 0;
}

/* -------------------------------------------------------------------------- */
/* Moving the market                                                           */
/* -------------------------------------------------------------------------- */

const MARKET_EFFECT: Readonly<Record<MarketState, number>> = {
  severeRecession: -0.42,
  recession: -0.22,
  slowdown: -0.08,
  normal: 0,
  growth: 0.07,
  strongExpansion: 0.16,
};

/**
 * HOW A NAME'S YEAR IS SPLIT between the sector it belongs to and its own luck.
 *
 * These three numbers decide whether diversification means anything, and the
 * first version of them meant almost nothing. `SECTOR_WEIGHT` was 0.55 against
 * a sector shock of 0.14, which put the shared term at a fraction of an
 * instrument's own spread (0.19-0.35). Measured directly, the correlation
 * between two technology names came out at 0.276 against 0.246 for a
 * technology name and a consumer one — a gap of THREE HUNDREDTHS. Sectors were
 * a heading.
 *
 * It passed a portfolio-level test anyway, which is the part worth remembering:
 * six technology names really are wider than six names one-per-sector, but
 * because technology names have higher drift and wider spreads, not because
 * they share a fate. The test could not tell those apart and neither could I
 * until the correlation was measured on its own.
 *
 * So the variance is REDISTRIBUTED rather than added: the sector term goes up
 * and each instrument's own goes down by `IDIOSYNCRATIC`, which keeps a single
 * holding about as volatile as it was and makes six of them in one sector a
 * genuinely different proposition from six spread out.
 */
export const SECTOR_SHOCK = 0.26;
export const SECTOR_WEIGHT = 0.85;
/** What is left for an instrument's own luck once the sector has had its share. */
export const IDIOSYNCRATIC = 0.62;

/** A cheap symmetric shock from a flat roll: tails exist, middle is likelier. */
function bell(roll: number): number {
  const clamped = Math.max(0.0001, Math.min(0.9999, roll));
  const shock = (clamped - 0.5) * 2;
  return Math.sign(shock) * shock * shock * 1.7;
}

export interface MarketMove {
  readonly prices: PriceBook;
  /** Sector shocks this year, for the feed and for tests. */
  readonly sectorMoves: Readonly<Partial<Record<Sector, number>>>;
}

/**
 * One year of prices.
 *
 * `rolls` are taken rather than drawn, for the reason everything in this
 * package takes them: a life has to replay identically from its seed, and an
 * engine that reaches for a generator inside itself cannot be tested by handing
 * it the year you want to see. One roll per sector first, then one per
 * instrument, in catalog order.
 */
export function runPriceYear(
  book: PriceBook,
  state: MarketState,
  sectorRolls: readonly number[],
  instrumentRolls: readonly number[],
): MarketMove {
  const sectorMoves: Partial<Record<Sector, number>> = {};
  const sectors: readonly Sector[] = [
    'technology',
    'health',
    'finance',
    'energy',
    'consumer',
    'industrial',
    'communication',
  ];
  sectors.forEach((sector, index) => {
    // A sector's own weather, independent of the broad market. The spread is
    // fixed rather than per-sector: what varies between sectors is how hard
    // their members are pulled by the broad market (`beta`), not how moody the
    // sector itself is.
    sectorMoves[sector] = bell(sectorRolls[index] ?? 0.5) * SECTOR_SHOCK;
  });

  const history: Record<string, readonly number[]> = { ...book.history };

  INSTRUMENTS.forEach((instrument, index) => {
    const current = priceOf(book, instrument.id);
    const own = bell(instrumentRolls[index] ?? 0.5) * instrument.spread * IDIOSYNCRATIC;
    const sector =
      instrument.sector !== undefined ? (sectorMoves[instrument.sector] ?? 0) * SECTOR_WEIGHT : 0;

    const raw = instrument.drift + MARKET_EFFECT[state] * instrument.beta + own + sector;
    /*
      One year can only do so much, in either direction — the bound 0308 put on
      the old engine after 0306 compounded $200 into $1.28bn unnoticed. The band
      is asymmetric because reality is: a year can take almost everything and
      cannot give back more than a couple of times over.
    */
    const growth = Math.max(-0.85, Math.min(1.2, raw));

    /*
      A PENNY STOCK CAN ACTUALLY GO TO NOTHING, and that is the tier's whole
      character. Everything else has a floor at 5% of its price — a large
      company does not evaporate in a year — but a sawmill with one contract
      absolutely does, and a floor of a single cent is what says so.
    */
    /*
      A PENNY STOCK CAN ACTUALLY GO TO NOTHING — that is the tier's whole
      character — and everything else has a floor at 5% of its price, because a
      large company does not evaporate inside a year.

      NEVER BELOW ONE CENT, THOUGH, and that bound is not decoration. The 5%
      floor ROUNDS TO ZERO on anything cheap: a four-cent coin floors at
      `round(0.2)` = 0, so it decays to 2¢, then 1¢, then nothing, and a price
      of zero makes every holding of it worthless and every future purchase a
      division by zero. Found by a test that simply asserted no instrument is
      ever priced at zero.
    */
    const floor = instrument.kind === 'penny' ? 1 : Math.max(1, Math.round(current * 0.05));
    const next = Math.max(1, Math.max(floor, Math.round(current * (1 + growth))));

    const line = [...priceLine(book, instrument.id), next];
    history[instrument.id] = line.length > HISTORY_YEARS ? line.slice(-HISTORY_YEARS) : line;
  });

  return { prices: { history }, sectorMoves };
}

/** Seed a fresh book at the catalog's opening prices. */
export function openingPrices(): PriceBook {
  const history: Record<string, readonly number[]> = {};
  for (const instrument of INSTRUMENTS) history[instrument.id] = [instrument.priceCents];
  return { history };
}

/* -------------------------------------------------------------------------- */
/* Reading the market                                                          */
/* -------------------------------------------------------------------------- */

export interface MarketRow {
  readonly instrument: Instrument;
  /** Cents. */
  readonly price: number;
  /** Change since last year, as a fraction. */
  readonly change: number;
}

export const marketRow = (book: PriceBook, instrument: Instrument): MarketRow => ({
  instrument,
  price: priceOf(book, instrument.id),
  change: yearChange(book, instrument.id),
});

/**
 * How a whole sector is doing, as a share of its names that rose.
 *
 * Spec 706-724 forbids an economy dashboard, so this is not one: it is a
 * per-sector reading shown on the screen the effect lands on, which is what
 * "contextual market effects" means. The reference app shows a "Market Health"
 * bar on two of its five tiers and not the other three; this is the same idea
 * applied consistently, because a reading that appears on some rows and not
 * others reads as a bug.
 */
export function sectorHealth(book: PriceBook, sector: Sector): number {
  const rows = INSTRUMENTS.filter((row) => row.sector === sector);
  if (rows.length === 0) return 0.5;
  const rising = rows.filter((row) => yearChange(book, row.id) > 0).length;
  return rising / rows.length;
}

/** The same reading for a whole tier, which is what the hub screen shows. */
export function kindHealth(book: PriceBook, kind: Instrument['kind']): number {
  const rows = INSTRUMENTS.filter((row) => row.kind === kind);
  if (rows.length === 0) return 0.5;
  const rising = rows.filter((row) => yearChange(book, row.id) > 0).length;
  return rising / rows.length;
}
