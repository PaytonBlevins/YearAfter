/**
 * Ticket 0506 — jewelry, watches and valuable collections, and the stores
 * that sell them.
 *
 * Authored by `scripts/generate-valuables.py`. Stock is drawn from this each
 * year, so it is a table of what exists rather than a shop's shelves. Logic
 * reads the ids, `kind`, `holds` and `price`, never the names (spec 1456).
 */

import valuablesData from '../data/valuables.json';

export type ValuableKind =
  | 'watch'
  | 'ring'
  | 'necklace'
  | 'chain'
  | 'bracelet'
  | 'earrings'
  | 'art'
  | 'antique'
  | 'historical'
  | 'curio'
  | 'mythical';

/** How it holds its value. See `RESALE` and `DRIFT` in `@yearafter/finance`. */
export type ValuableHolds =
  'fashion' | 'precious' | 'watch' | 'sought' | 'art' | 'antique' | 'curio' | 'mythical';

export type ValuableRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'mythical';

export interface Valuable {
  readonly id: string;
  readonly kind: ValuableKind;
  readonly name: string;
  readonly brand: string;
  /** Retail, whole dollars, 2025. */
  readonly price: number;
  readonly holds: ValuableHolds;
  readonly stores: readonly string[];
  readonly rarity: ValuableRarity;
  readonly blurb: string;
}

export interface ValuableStore {
  readonly id: string;
  readonly name: string;
  readonly kinds: readonly ValuableKind[];
  /** Pieces on show in a year. */
  readonly size: number;
  /** The hidden gate, whole dollars of means. Zero: open to anybody. */
  readonly means: number;
  readonly blurb: string;
}

const catalog = valuablesData as unknown as {
  readonly version: number;
  readonly stores: readonly ValuableStore[];
  readonly entries: readonly Valuable[];
};

export const VALUABLES: readonly Valuable[] = catalog.entries;
export const VALUABLE_STORES: readonly ValuableStore[] = catalog.stores;

const BY_ID = new Map(VALUABLES.map((valuable) => [valuable.id, valuable]));
const STORES_BY_ID = new Map(VALUABLE_STORES.map((store) => [store.id, store]));

export const findValuable = (id: string): Valuable | undefined => BY_ID.get(id);
export const findValuableStore = (id: string): ValuableStore | undefined => STORES_BY_ID.get(id);

/**
 * Spec 1893: "Collections organize automatically". The shelves a collection is
 * shown on, in order.
 */
export type CollectionShelf = 'watches' | 'jewelry' | 'art' | 'antiques' | 'curios' | 'legendary';

export const COLLECTION_SHELVES: readonly CollectionShelf[] = [
  'watches',
  'jewelry',
  'art',
  'antiques',
  'curios',
  'legendary',
];

export const COLLECTION_SHELF_LABELS: Readonly<Record<CollectionShelf, string>> = {
  watches: 'Watches',
  jewelry: 'Jewelry',
  art: 'Art',
  antiques: 'Antiques and history',
  curios: 'Curiosities',
  legendary: 'Legendary',
};

export const shelfOf = (kind: ValuableKind): CollectionShelf =>
  kind === 'watch'
    ? 'watches'
    : kind === 'art'
      ? 'art'
      : kind === 'antique' || kind === 'historical'
        ? 'antiques'
        : kind === 'curio'
          ? 'curios'
          : kind === 'mythical'
            ? 'legendary'
            : 'jewelry';
