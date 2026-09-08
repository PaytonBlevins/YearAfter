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

/** Ticket 0210 — real jobs, with salaries and ladders. */
export * from './jobs';
