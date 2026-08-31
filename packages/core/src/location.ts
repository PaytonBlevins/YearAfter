/**
 * Ticket 0003 — Location.
 *
 * Spec 4.1 / 828–838: birth country, region and city are backend-only history
 * after character creation. Current country, region and city are player-facing.
 * The two are deliberately separate types so a UI screen cannot accidentally
 * render birth geography.
 */

export interface Location {
  /** ISO-3166 alpha-2 where one exists, otherwise a stable content id. */
  readonly countryCode: string;
  /** State, province or region code, stable across content revisions. */
  readonly regionCode: string;
  /** Stable city id from the location catalog. */
  readonly cityId: string;
}

/** Where the character lives now. Player-facing. */
export interface CurrentLocation extends Location {}

/**
 * Where the character was born. Backend/history only — never rendered as a
 * normal profile field, and citizenship is never shown at all (spec 4.1).
 */
export interface BirthLocation extends Location {}

export const sameLocation = (a: Location, b: Location): boolean =>
  a.countryCode === b.countryCode && a.regionCode === b.regionCode && a.cityId === b.cityId;

export const sameRegion = (a: Location, b: Location): boolean =>
  a.countryCode === b.countryCode && a.regionCode === b.regionCode;
