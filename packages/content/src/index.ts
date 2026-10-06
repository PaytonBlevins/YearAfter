/**
 * @yearafter/content — versioned content catalogs.
 *
 * Spec 1213–1223: content is data, not code. Cars, jobs, gifts, locations,
 * names and event text all live here as JSON with stable IDs, and can be
 * expanded without touching logic. Logic depends on the IDs, never on display
 * names (CORE_RULES 13).
 *
 * The JSON is imported rather than read from disk so the catalogs bundle into
 * the app and the balance tools alike, with no filesystem at runtime.
 */

import locationsData from '../data/locations.json';
import namesData from '../data/names.json';

/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

export interface CultureWeight {
  readonly culture: string;
  readonly weight: number;
}

/**
 * One birthplace. Region and country are denormalised onto the city so a birth
 * draw is a single weighted pick rather than three nested ones — which also
 * keeps the odds honest, since nesting would make a country with few listed
 * cities as likely as one with many.
 */
export interface CityEntry {
  readonly id: string;
  readonly city: string;
  readonly regionCode: string;
  readonly region: string;
  readonly countryCode: string;
  readonly country: string;
  /** Birth-likelihood weight. Loosely population-shaped, not a population. */
  readonly weight: number;
  /**
   * Ticket 0303. What a year of ordinary life costs here, relative to 1.00.
   *
   * Spec 191–193 names location first among the things living costs are
   * inferred from, and nothing in the build could act on it until this field
   * existed. US cities carry real relative numbers; everywhere else sits in a
   * narrower band, because every salary and price in this build is
   * US-benchmarked and a true index would hand a character a US wage against a
   * fifth of a US cost. `scripts/generate-catalogs.py` says it at length.
   */
  readonly costIndex: number;
  /** The naming traditions a character born here draws from. */
  readonly nameCultures: readonly CultureWeight[];
}

export const CITIES: readonly CityEntry[] = locationsData.entries as readonly CityEntry[];

const CITIES_BY_ID = new Map(CITIES.map((city) => [city.id, city]));

export const findCity = (id: string): CityEntry | undefined => CITIES_BY_ID.get(id);

/**
 * Display form for a birthplace or current location. The UI must call this
 * rather than concatenating fields itself, so that region-first countries can
 * be handled here later without touching screens.
 */
/**
 * The cost index of a city, or the national baseline for an id nothing knows.
 *
 * The fallback is 1.00 rather than a throw because a save can outlive a catalog
 * entry — 0207c's whole lesson — and a character whose birth city was renamed
 * between builds should keep playing at an average cost, not crash on load. The
 * generator refuses to emit a city without one, so this never fires in a build
 * that shipped its own catalog.
 */
export const costIndexOf = (id: string): number => CITIES_BY_ID.get(id)?.costIndex ?? 1;

/**
 * Ticket 0501. The state or region a city is in, as a stable key and a name.
 *
 * Spec 145: *"Only show homes in the player's current state."* The key joins
 * country and region so two countries' regions with the same code never
 * collide.
 */
export function regionOf(id: string): { readonly key: string; readonly name: string } {
  const city = CITIES_BY_ID.get(id);
  if (!city) return { key: 'unknown', name: 'Unknown' };
  return { key: `${city.countryCode}:${city.regionCode}`, name: city.region };
}

/**
 * Ticket 0501. The cost index of a whole region: the plain mean of its cities.
 *
 * Unweighted on purpose. A state's housing market is not New York City just
 * because most of its people live there, and weighting by population would
 * price a house upstate as though it were in Manhattan.
 */
export function regionCostIndex(id: string): number {
  const home = regionOf(id).key;
  const inRegion = CITIES.filter((city) => `${city.countryCode}:${city.regionCode}` === home);
  if (inRegion.length === 0) return 1;
  return inRegion.reduce((sum, city) => sum + city.costIndex, 0) / inRegion.length;
}

/**
 * Ticket 0503. The same mean, from a region's key — an owned home keeps the
 * key of where it is, not a city, and its rent is set by the region.
 */
export function regionCostIndexOf(regionKey: string): number {
  const inRegion = CITIES.filter((city) => `${city.countryCode}:${city.regionCode}` === regionKey);
  if (inRegion.length === 0) return 1;
  return inRegion.reduce((sum, city) => sum + city.costIndex, 0) / inRegion.length;
}

export function describeCity(id: string): string {
  const city = CITIES_BY_ID.get(id);
  if (!city) return 'Unknown';
  return city.countryCode === 'US'
    ? `${city.city}, ${city.regionCode}`
    : `${city.city}, ${city.country}`;
}

/* -------------------------------------------------------------------------- */
/* Names                                                                       */
/* -------------------------------------------------------------------------- */

export interface NameCulture {
  readonly id: string;
  readonly label: string;
  readonly male: readonly string[];
  readonly female: readonly string[];
  readonly surnames: readonly string[];
}

export const NAME_CULTURES: readonly NameCulture[] = namesData.entries as readonly NameCulture[];

const CULTURES_BY_ID = new Map(NAME_CULTURES.map((culture) => [culture.id, culture]));

export const findNameCulture = (id: string): NameCulture | undefined => CULTURES_BY_ID.get(id);

/* -------------------------------------------------------------------------- */
/* Events (Ticket 0203)                                                        */
/* -------------------------------------------------------------------------- */

export * from './events';

/* -------------------------------------------------------------------------- */
/* Extracurricular activities (Ticket 0204)                                    */
/* -------------------------------------------------------------------------- */

export * from './activities';

/** Ticket 0206b — odd jobs a child can actually do for money. */
export * from './gigs';

/* Investable instruments (Ticket 0308c)                                       */
export * from './instruments';

/* -------------------------------------------------------------------------- */
/* Financial headlines (Ticket 0308d)                                          */
export * from './headlines';

/* -------------------------------------------------------------------------- */
/* Advisors and what they say (Ticket 0309)                                    */
export * from './advice';

/** Ticket 0210 — real jobs, with salaries and ladders. */
export * from './jobs';

/** Ticket 0501 — the kinds of home a character can buy and live in. */
export * from './homes';
export * from './vehicles';
export * from './renovations';
export * from './valuables';
export * from './auctions';
export * from './businesses';
export * from './deals';
export * from './deal-lines';
export * from './commercial';
export * from './creators';
export * from './creator-lines';
export * from './creator-events';
export * from './sponsors';
export * from './creator-network';
export * from './celebrity';
export * from './fame-work';

export * from './post-formats';
