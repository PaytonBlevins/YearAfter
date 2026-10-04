/**
 * Ticket 0506 — what can be done to a home.
 *
 * Authored by `scripts/generate-renovations.py`: spec 153–154 and 1875's list,
 * and nothing else. A `refresh` (kitchens, bathrooms, finishes) lifts a home's
 * condition and can be redone once it has aged; anything else is an addition,
 * done once, which adds part of its cost to the home's value.
 */

import renovationsData from '../data/renovations.json';

export interface Renovation {
  readonly id: string;
  readonly name: string;
  /** One per group on a home: a luxury kitchen replaces a modern one. */
  readonly group: string;
  readonly refresh: boolean;
  /** A refresh's cost as a share of the home's value, with a floor. */
  readonly share: number;
  readonly floor: number;
  /** An addition's cost at cost index 1.00, whole dollars. */
  readonly cost: number;
  /** What a buyer pays for it, as a share of its cost, the day it is done. */
  readonly recovery: number;
  /** Whole dollars a year to keep it running. */
  readonly upkeep: number;
  /** Bedrooms it adds. */
  readonly beds: number;
  /** A refresh can be done again this many years later. Zero: once only. */
  readonly redoAfter: number;
  /** The home kinds it can be done to. */
  readonly kinds: readonly string[];
  /** Another renovation it needs first. */
  readonly needs?: string;
  /** How it reads in a sentence: "a new kitchen", "an infinity pool". */
  readonly phrase: string;
  readonly blurb: string;
}

const catalog = renovationsData as unknown as {
  readonly version: number;
  readonly entries: readonly Renovation[];
};

export const RENOVATIONS: readonly Renovation[] = catalog.entries;

const BY_ID = new Map(RENOVATIONS.map((renovation) => [renovation.id, renovation]));

export const findRenovation = (id: string): Renovation | undefined => BY_ID.get(id);
