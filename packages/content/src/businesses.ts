/**
 * Ticket 0601 — the businesses a character can start.
 *
 * Authored by `scripts/generate-businesses.py`. A table of what exists: a type
 * says what a business of that kind sells, what it costs to open and what a
 * year of it looks like at maturity. Logic depends on the ids and the numbers,
 * never on the names (spec 1456); the names a business is called by are drawn
 * from `names`, a few to a type.
 *
 * The twelve here are a representative set (spec 1356–1360). Spec 396's other
 * types arrive in 0602.
 */

import businessesData from '../data/businesses.json';

/** The two stats that help an owner of this kind of business. */
export type BusinessSkill =
  'happiness' | 'health' | 'smarts' | 'looks' | 'charisma' | 'willpower' | 'discipline';

export interface BusinessType {
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly blurb: string;
  /** Whole dollars to open the doors: fittings and a float. */
  readonly startup: number;
  /** A year at maturity, standard price, medium pay, a full-time owner. */
  readonly revenue: number;
  /** What the goods cost, as a share of revenue at the standard supplier. */
  readonly cogs: number;
  /** The headcount that serves that revenue, the owner not counted. */
  readonly staff: number;
  /** It cannot open its doors with fewer. */
  readonly staffMin: number;
  /** One employee a year at medium pay, payroll tax included. */
  readonly wage: number;
  /** Rent, insurance, the lease on the van: owed however it sells. */
  readonly overhead: number;
  /** The share of the startup that is fittings and keeps some value. */
  readonly assetShare: number;
  /** How fast customers leave when the price goes up. */
  readonly elasticity: number;
  /** How much of a bad economy it feels. 0 is none, 1 is all of it. */
  readonly cyclical: number;
  /** How far one year lands from the last. */
  readonly volatility: number;
  /** Years it takes a new business to find its customers. */
  readonly ramp: number;
  /** Ticket 0602: how far past a normal year it can sell with the same people. 1 for most. */
  readonly headroom: number;
  /** How much quality is what it buys rather than who serves. Zero: no supplier to choose. */
  readonly productShare: number;
  readonly supplier: boolean;
  readonly skills: readonly [BusinessSkill, BusinessSkill];
  /** What a buyer pays, in years of profit. */
  readonly valueMultiple: number;
  /** Net worth that makes it show up in the marketplace (spec 912). */
  readonly gate: number;
  readonly names: readonly string[];
}

interface BusinessCatalogFile {
  readonly version: number;
  readonly entries: readonly BusinessType[];
}

const catalog = businessesData as unknown as BusinessCatalogFile;

export const BUSINESS_TYPES: readonly BusinessType[] = catalog.entries;
export const BUSINESS_CATALOG_VERSION = catalog.version;

const BY_ID = new Map(BUSINESS_TYPES.map((type) => [type.id, type]));

export const findBusinessType = (id: string): BusinessType | undefined => BY_ID.get(id);
