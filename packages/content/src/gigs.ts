/**
 * Ticket 0206b — odd jobs, as content.
 *
 * Authored by `scripts/generate-gigs.py`. Like every other catalog, logic
 * depends on the stable ids here and never on the display names
 * (CORE_RULES 13).
 *
 * These are NOT employment. Ticket 0210 builds real jobs with salaries and
 * promotion paths; these are the things a child can actually do for money, and
 * the age gate is the whole point of them.
 */

import type { TalentKey, VisibleStatKey } from '@yearafter/character';
import gigsData from '../data/gigs.json';

export interface Gig {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** The age this becomes legal, plausible, or both. */
  readonly ageMin: number;
  readonly ageMax: number;
  /** Whole dollars for a YEAR of it — the game's unit of time is a year. */
  readonly payLow: number;
  readonly payHigh: number;
  readonly hoursPerWeek: number;
  /**
   * Where the money came from, as a phrase that reads inside a sentence.
   * Required: an unexplained balance change is a bug (CORE_RULES 13.6).
   */
  readonly source: string;
  /** The stat that decides how well it went, and so what it paid. */
  readonly stat: VisibleStatKey;
  /** A talent that makes this genuinely lucrative rather than just possible. */
  readonly talent?: TalentKey;
  /** Needs an adult at home — babysitting somebody else's kids at twelve does. */
  readonly needsParent?: boolean;
  /** Feed lines. `${amount}` is required in every one of them. */
  readonly lines: readonly string[];
}

interface GigCatalogFile {
  readonly version: number;
  readonly entries: readonly Gig[];
}

const catalog = gigsData as unknown as GigCatalogFile;

export const GIGS: readonly Gig[] = catalog.entries;
export const GIG_CATALOG_VERSION = catalog.version;

const BY_ID = new Map(GIGS.map((gig) => [gig.id, gig]));

export const findGig = (id: string): Gig | undefined => BY_ID.get(id);

export const gigsForAge = (age: number): readonly Gig[] =>
  GIGS.filter((gig) => age >= gig.ageMin && age <= gig.ageMax);
