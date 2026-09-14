/**
 * Ticket 0308c — investable instruments, as content.
 *
 * Authored by `scripts/generate-instruments.py`. Logic depends on the stable
 * ids here and never on the display names (CORE_RULES 13).
 *
 * WHAT CHANGED FROM 0308. That ticket shipped seven PRODUCTS — "Index Fund",
 * "Growth Shares", "Crypto" — categories with a drift and a spread. A player
 * could hold a kind of thing but never a thing. This catalog is the other
 * model: eighty-nine named instruments, each with a ticker, a price per unit
 * and a sector, so a holding is "412 shares of Northline Freight at $103.25"
 * rather than "$42,000 of stocks".
 *
 * Everything engaging about an investment screen follows from the price being
 * a real number that moves and that the player recognises.
 */

import instrumentsData from '../data/instruments.json';

/** Spec 1691's four classes, plus the penny tier the reference app separates. */
export type InstrumentKind = 'stock' | 'penny' | 'crypto' | 'fund' | 'bond';

/**
 * Sectors, which exist so that diversification can be a real decision.
 *
 * Instruments sharing a sector take one shared shock each year on top of their
 * own. Holding six technology names is not six decisions, and this is what
 * makes that true in the numbers rather than only in the fiction.
 */
export type Sector =
  'technology' | 'health' | 'finance' | 'energy' | 'consumer' | 'industrial' | 'communication';

export interface Instrument {
  readonly id: string;
  readonly name: string;
  /** Short symbol, unique across the catalog. What the market list shows. */
  readonly ticker: string;
  readonly kind: InstrumentKind;
  /** Absent for crypto and for government bonds — neither belongs to one. */
  readonly sector?: Sector;
  /** Bonds only: who owes the money. */
  readonly issuer?: string;
  /** The opening price, in cents. A live price lives in the save, not here. */
  readonly priceCents: number;
  /** What an ordinary year does, before the market and before luck. */
  readonly drift: number;
  /** Its own year-to-year scatter. */
  readonly spread: number;
  /** How hard the market state pulls it. */
  readonly beta: number;
  /** Paid out as cash each year — a dividend, or a bond's coupon. */
  readonly payout: number;
  /** Bonds only: years until the principal comes back. Zero for everything else. */
  readonly termYears: number;
  /** One line about what this actually is. At most 64 characters. */
  readonly blurb: string;
}

interface InstrumentCatalogFile {
  readonly version: number;
  readonly entries: readonly Instrument[];
}

const catalog = instrumentsData as unknown as InstrumentCatalogFile;

export const INSTRUMENTS: readonly Instrument[] = catalog.entries;

const BY_ID = new Map(INSTRUMENTS.map((row) => [row.id, row]));

export const findInstrument = (id: string): Instrument | undefined => BY_ID.get(id);

export const instrumentsOfKind = (kind: InstrumentKind): readonly Instrument[] =>
  INSTRUMENTS.filter((row) => row.kind === kind);

export const instrumentsInSector = (sector: Sector): readonly Instrument[] =>
  INSTRUMENTS.filter((row) => row.sector === sector);

/** Every sector that has anything in it, in catalog order. */
export const SECTORS: readonly Sector[] = [
  'technology',
  'health',
  'finance',
  'energy',
  'consumer',
  'industrial',
  'communication',
];

export const SECTOR_LABELS: Readonly<Record<Sector, string>> = {
  technology: 'Technology',
  health: 'Health',
  finance: 'Finance',
  energy: 'Energy',
  consumer: 'Consumer',
  industrial: 'Industrial',
  communication: 'Communication',
};

export const KIND_LABELS: Readonly<Record<InstrumentKind, string>> = {
  stock: 'Stocks',
  penny: 'Penny stocks',
  crypto: 'Crypto',
  fund: 'Funds',
  bond: 'Bonds',
};

/** The bond issuers in the catalog, in the order they first appear. */
export const BOND_ISSUERS: readonly string[] = [
  ...new Set(
    INSTRUMENTS.filter((row) => row.kind === 'bond' && row.issuer !== undefined).map(
      (row) => row.issuer!,
    ),
  ),
];
