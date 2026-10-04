/**
 * Ticket 0501 — the kinds of home a character can buy.
 *
 * Authored by `scripts/generate-homes.py`. A listing is generated from a kind
 * each year rather than stored (spec 147), so this is a short table of shapes,
 * not a list of houses. Logic depends on the ids, never on the names.
 */

import homesData from '../data/homes.json';

export interface HomeKind {
  readonly id: string;
  /** The listing's type line: "Townhouse". */
  readonly name: string;
  /** How it reads in a sentence: "a townhouse". */
  readonly noun: string;
  readonly beds: readonly [number, number];
  readonly baths: readonly [number, number];
  /** Asking-price band at cost index 1.00, whole dollars. */
  readonly price: readonly [number, number];
  /**
   * A year of owning it — taxes, insurance and upkeep as one number — as a
   * share of its value. Spec 151 removes insurance and HOA as mechanics.
   */
  readonly expenseRate: number;
  /** How old a listed one can be, in years. */
  readonly age: readonly [number, number];
  /** How often it turns up in a year's listings. */
  readonly weight: number;
  /**
   * The hidden gate, whole dollars: shown only to somebody whose means reach
   * it. Never displayed (spec 1356's "no visible wealth-tier labels").
   */
  readonly means: number;
  /** Ticket 0503. Households it lets to: one for a house, 2/5/10/25 for rental buildings. */
  readonly units: number;
  /** Ticket 0503. Owned to let, never lived in — a duplex or an apartment building. */
  readonly rental: boolean;
  /**
   * Ticket 0503. A year's rent at the going rate over the price, at cost index
   * 1.00. Divided by the region's index for the rent actually asked, because
   * rent follows a place's costs roughly in step while prices follow them
   * squared — so a dear region yields less.
   */
  readonly rentYield: number;
  readonly blurbs: readonly string[];
}

interface HomeCatalogFile {
  readonly version: number;
  readonly entries: readonly HomeKind[];
}

const catalog = homesData as unknown as HomeCatalogFile;

export const HOME_KINDS: readonly HomeKind[] = catalog.entries;
export const HOME_CATALOG_VERSION = catalog.version;

const BY_ID = new Map(HOME_KINDS.map((kind) => [kind.id, kind]));

export const findHomeKind = (id: string): HomeKind | undefined => BY_ID.get(id);
