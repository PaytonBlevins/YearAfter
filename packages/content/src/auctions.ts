/**
 * Ticket 0507 — the auction venues, and the words for storage units.
 *
 * Authored by `scripts/generate-auctions.py`. What is sold comes from the
 * valuables (0506) and vehicles (0504) catalogs; this is where it is sold, how
 * often a year, and who may come.
 */

import auctionsData from '../data/auctions.json';
import type { ValuableKind } from './valuables';
import type { VehicleMarketTier } from './vehicles';

export type AuctionVenueType = 'general' | 'storage' | 'private';

export interface AuctionVenue {
  readonly id: string;
  readonly name: string;
  readonly type: AuctionVenueType;
  /** Spec 41: how many sales a year this character may attend. */
  readonly visits: number;
  /** Lots (or units) in one sale. */
  readonly lots: number;
  /** The hidden gate, whole dollars of means. Zero: open to anybody. */
  readonly means: number;
  readonly kinds: readonly ValuableKind[];
  readonly cars: readonly VehicleMarketTier[];
  /** Share of lots that are cars. */
  readonly carShare: number;
  readonly blurb: string;
}

export type StorageSize = 'small' | 'medium' | 'large';

const catalog = auctionsData as unknown as {
  readonly version: number;
  readonly entries: readonly AuctionVenue[];
  readonly peeks: Readonly<Record<StorageSize, readonly string[]>>;
  readonly junk: readonly string[];
};

export const AUCTION_VENUES: readonly AuctionVenue[] = catalog.entries;
export const STORAGE_PEEKS: Readonly<Record<StorageSize, readonly string[]>> = catalog.peeks;
export const STORAGE_JUNK: readonly string[] = catalog.junk;

const BY_ID = new Map(AUCTION_VENUES.map((venue) => [venue.id, venue]));

export const findAuctionVenue = (id: string): AuctionVenue | undefined => BY_ID.get(id);
