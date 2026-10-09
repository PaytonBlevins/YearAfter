/**
 * Ticket 0506 — shopping, and the collection it fills.
 *
 * Spec 1363: "Shopping should primarily live under Assets → Shopping, because
 * purchased goods become owned items." Spec 1366: a store shows a curated
 * handful, not the catalog. Spec 1893: "Collections organize automatically;
 * no manual organization chores. General sale button only."
 *
 * STOCK IS DERIVED, NOT STORED — the rule homes and cars follow (CORE_RULES
 * 13.19). A store's pieces this year come from the seed, the year and the
 * store, so every visit in a year sees the same counter and next year a new
 * one. Two stores sit behind a hidden gate (spec 1356): the appointment-only
 * one, and the expensive end of the gallery.
 *
 * NO DOOR. Buying jewelry is something people choose to do; the game buying it
 * for the passive population would be choosing their taste for them.
 *
 * THE MYTHICAL. Spec 197 and 1249: a handful of legendary objects, "extremely
 * rare". One in 5,000 of the antiques dealer's slots — a player who looks every
 * year of an adult life has a few percent chance of ever seeing one. They are
 * collection content, never a stat.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  COLLECTION_SHELVES,
  VALUABLES,
  VALUABLE_STORES,
  findValuable,
  findValuableStore,
  shelfOf,
  type CollectionShelf,
  type Valuable,
  type ValuableStore,
} from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import {
  icingValue,
  payPurchase,
  paymentNote,
  PAYMENT_REFUSAL_LABELS,
  type PurchasePayment,
  type PaymentRefusal,
  portfolioWorth,
  post,
  resaleAtPurchase,
  valuableYear,
  type OwnedValuable,
} from '@yearafter/finance';
import { incomeOf } from './cards';
import type { GameState } from './game-state';

/** Old enough to walk into a jeweler's and buy something. */
export const SHOP_VALUABLES_FROM_AGE = 16;
/** A store never shows a piece dearer than this many times somebody's means. */
export const STORE_REACH = 1.5;
/** Spec 1249: extremely rare. Per slot at the antiques dealer. */
export const MYTHICAL_CHANCE = 0.0002;

export interface StockPiece {
  /** `val:<year>:<store>:<slot>`. Becomes the owned piece's id. */
  readonly id: string;
  readonly storeId: string;
  readonly item: Valuable;
  /** Whole dollars, this year, at this store. */
  readonly price: number;
}

/** Cash, investments and a year's income, whole dollars — the hidden gate. Never shown. */
export function shoppingMeansOf(state: GameState): number {
  const cash = Number(state.player.cash) / 100;
  const invested = Number(portfolioWorth(state.prices, state.portfolio)) / 100;
  return Math.max(0, cash + invested + incomeOf(state));
}

const unit = (state: GameState, key: string) =>
  mixedUnit(`${state.rng.getSeed()}:${state.world.year}:${key}`);

function stock(state: GameState, store: ValuableStore, means: number): readonly StockPiece[] {
  const ceiling = Math.max(2_000, means * STORE_REACH);
  const pool = VALUABLES.filter(
    (item) =>
      item.stores.includes(store.id) &&
      store.kinds.includes(item.kind) &&
      item.kind !== 'mythical' &&
      item.price <= ceiling,
  );
  const legends = VALUABLES.filter(
    (item) => item.kind === 'mythical' && item.stores.includes(store.id),
  );
  if (pool.length === 0 && legends.length === 0) return [];
  const pieces: StockPiece[] = [];
  const used = new Set<string>();
  for (let slot = 0; slot < store.size; slot += 1) {
    const key = `val:${store.id}:${slot}`;
    let item: Valuable | undefined;
    if (legends.length > 0 && unit(state, `${key}:legend`) < MYTHICAL_CHANCE) {
      item = legends[Math.floor(unit(state, `${key}:which-legend`) * legends.length)];
    } else if (pool.length > 0) {
      // A different piece in each slot where the shelf allows it.
      const start = Math.floor(unit(state, `${key}:item`) * pool.length);
      for (let step = 0; step < pool.length; step += 1) {
        const candidate = pool[(start + step) % pool.length]!;
        if (!used.has(candidate.id)) {
          item = candidate;
          break;
        }
      }
    }
    if (!item) continue;
    used.add(item.id);
    const price = Math.max(
      10,
      Math.round((item.price * (0.97 + 0.06 * unit(state, `${key}:price`))) / 10) * 10,
    );
    pieces.push({
      id: `val:${state.world.year}:${store.id}:${slot}`,
      storeId: store.id,
      item,
      price,
    });
  }
  return pieces.sort((a, b) => a.price - b.price);
}

/** One store's counter this year, less anything already bought from it. */
export function storeStock(state: GameState, storeId: string): readonly StockPiece[] {
  if (state.player.age < SHOP_VALUABLES_FROM_AGE) return [];
  const store = findValuableStore(storeId);
  if (!store) return [];
  const means = shoppingMeansOf(state);
  if (means < store.means) return [];
  const owned = new Set(state.valuables.map((piece) => piece.id));
  return stock(state, store, means).filter((piece) => !owned.has(piece.id));
}

/** The stores this character would be shown. The gated ones only behind the gate. */
export const openStores = (state: GameState): readonly ValuableStore[] =>
  VALUABLE_STORES.filter((store) => storeStock(state, store.id).length > 0);

export type BuyValuableError =
  | 'no-such-piece'
  | 'cannot-afford'
  | 'too-young'
  | 'not-customizable'
  | 'already-iced'
  | 'known-reproduction'
  | PaymentRefusal;

export const BUY_VALUABLE_ERROR_LABELS: Readonly<Record<BuyValuableError, string>> = {
  ...PAYMENT_REFUSAL_LABELS,
  'not-customizable': "This watch can't be iced out.",
  'already-iced': "This one's already iced out.",
  'known-reproduction': "The jeweler won't customize a known reproduction.",
  'no-such-piece': "That piece isn't available any more.",
  'cannot-afford': "You don't have the money for that.",
  'too-young': "You're too young to buy that.",
};

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function line(
  state: GameState,
  text: string,
  key: string,
  kind: 'milestone' | 'passive',
): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

export interface ShoppingOutcome {
  readonly state: GameState;
  readonly piece: OwnedValuable;
  readonly entry: TimelineEntry;
}

/**
 * Buy a piece off the counter. A transfer (`property`), like a house or a car:
 * the money became a thing — worth less than was paid the moment it is yours,
 * as anything bought at retail is.
 */
export function buyValuable(
  state: GameState,
  stockId: string,
  payment: PurchasePayment = { kind: 'cash' },
  finish: 'original' | 'iced' = 'original',
): Result<ShoppingOutcome, BuyValuableError> {
  if (state.player.age < SHOP_VALUABLES_FROM_AGE) return err('too-young');
  const storeId = stockId.split(':')[2];
  const piece = storeId
    ? storeStock(state, storeId).find((candidate) => candidate.id === stockId)
    : undefined;
  if (!piece) return err('no-such-piece');
  const quote = valuablePurchaseQuote(piece, finish);
  if (!quote.ok) return quote;
  const paid = payPurchase(
    state.finance,
    state.cards,
    state.world.year,
    state.player.age,
    dollars(quote.value.total),
    'property',
    `Bought ${articled(piece.item)}`,
    payment,
  );
  if (!paid.ok) return err(paid.error === 'payment-cash-short' ? 'cannot-afford' : paid.error);
  const owned: OwnedValuable = {
    id: piece.id,
    itemId: piece.item.id,
    boughtYear: state.world.year,
    purchasePrice: dollars(piece.price),
    value: dollars(quote.value.resale),
    ...(finish === 'iced'
      ? { icing: { cost: dollars(quote.value.work), year: state.world.year } }
      : {}),
  };
  const books = paid.value;
  const legendary = piece.item.kind === 'mythical';
  const entry = line(
    state,
    legendary
      ? `Found ${articled(piece.item)} at the back of an antiques shop, and bought it for ${money(quote.value.total)}. Nobody believes you.`
      : `Bought ${articled(piece.item)}${finish === 'iced' ? ', iced out' : ''} for ${money(quote.value.total)}.${paymentNote(payment)}`,
    `val:bought:${piece.id}`,
    legendary ? 'milestone' : 'passive',
  );
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      cards: books.cards,
      valuables: [...state.valuables, owned],
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: legendary
          ? appendRecord(
              state.player.records,
              stampRecord(
                {
                  category: 'property',
                  label: `Owned ${piece.item.name}`,
                  referenceId: piece.item.id,
                },
                state.player.age,
                state.world.year,
              ),
            )
          : state.player.records,
      },
    },
    piece: owned,
    entry,
  });
}

/** Shared display/command quote: base resale first, then one customization effect. */
export function valuablePurchaseQuote(
  piece: StockPiece,
  finish: 'original' | 'iced' = 'original',
): Result<
  { readonly base: number; readonly work: number; readonly total: number; readonly resale: number },
  BuyValuableError
> {
  const policy = piece.item.icing;
  if (finish === 'iced' && policy?.kind !== 'aftermarket') return err('not-customizable');
  const work = finish === 'iced' && policy?.kind === 'aftermarket' ? policy.cost : 0;
  const original = dollars(resaleAtPurchase(piece.item, piece.price));
  return ok({
    base: piece.price,
    work,
    total: piece.price + work,
    resale: Number(finish === 'iced' ? icingValue(piece.item, original) : original) / 100,
  });
}

export function valuableIcingQuote(
  state: GameState,
  pieceId: string,
): Result<
  { readonly cost: number; readonly before: number; readonly after: number },
  BuyValuableError
> {
  const owned = state.valuables.find((piece) => piece.id === pieceId);
  if (!owned) return err('no-such-piece');
  if (owned.icing) return err('already-iced');
  const item = findValuable(owned.itemId);
  if (item?.kind !== 'watch' || item.icing?.kind !== 'aftermarket') return err('not-customizable');
  if (owned.reproduction) return err('known-reproduction');
  return ok({
    cost: item.icing.cost,
    before: Number(owned.value) / 100,
    after: Number(icingValue(item, owned.value)) / 100,
  });
}

/** All gates precede payment; a refusal cannot mutate ownership, ledger or RNG. */
export function iceValuable(
  state: GameState,
  pieceId: string,
  payment: PurchasePayment = { kind: 'cash' },
): Result<ShoppingOutcome, BuyValuableError> {
  const quote = valuableIcingQuote(state, pieceId);
  if (!quote.ok) return quote;
  const owned = state.valuables.find((piece) => piece.id === pieceId)!;
  const item = findValuable(owned.itemId)!;
  const paid = payPurchase(
    state.finance,
    state.cards,
    state.world.year,
    state.player.age,
    dollars(quote.value.cost),
    'property',
    `Iced out ${articled(item)}`,
    payment,
  );
  if (!paid.ok) return err(paid.error);
  const piece: OwnedValuable = {
    ...owned,
    value: dollars(quote.value.after),
    icing: { cost: dollars(quote.value.cost), year: state.world.year },
  };
  const entry = line(
    state,
    `Had ${articled(item)} iced out for ${money(quote.value.cost)}.${paymentNote(payment)}`,
    `val:iced:${pieceId}`,
    'passive',
  );
  return ok({
    piece,
    entry,
    state: {
      ...state,
      finance: paid.value.ledger,
      cards: paid.value.cards,
      valuables: state.valuables.map((held) => (held.id === pieceId ? piece : held)),
      player: {
        ...state.player,
        cash: paid.value.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
  });
}

/**
 * How a piece reads in a sentence: "a Rolux Subaquatic", "an 18k gold signet
 * ring", "a hand-knotted Persian rug", "Poseidon's Trident", "Maren Holt —
 * Harbor at Dusk (oil)". A named work or a legend takes no article; a generic
 * piece is lower-cased; a brand keeps its capital.
 */
export function articled(item: Pick<Valuable, 'name' | 'brand' | 'kind'>): string {
  const name = item.name;
  if (item.kind === 'mythical') return name.replace(/^The /, 'the ').replace(/^A /, 'a ');
  if (/ — /.test(name)) return name;
  const text = item.brand ? name : name.charAt(0).toLowerCase() + name.slice(1);
  const vowel = /^[aeiou]/i.test(text) || /^(8|11|18)\b|^(8|11|18)k/i.test(text);
  return `${vowel ? 'an' : 'a'} ${text}`;
}

export type SellValuableError = 'no-such-piece';

export interface SoldValuable {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly proceeds: number;
}

/** Spec 1893's one sale button: it fetches what it is worth. */
export function sellValuable(
  state: GameState,
  pieceId: string,
): Result<SoldValuable, SellValuableError> {
  const owned = state.valuables.find((piece) => piece.id === pieceId);
  if (!owned) return err('no-such-piece');
  const item = findValuable(owned.itemId);
  const proceeds = Math.round(Number(owned.value) / 100);
  const name = item ? articled(item) : 'it';
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(proceeds),
    source: `Sold ${name}`,
  });
  const entry = line(
    state,
    owned.inheritedFrom
      ? `Sold ${name}, the one that was ${owned.inheritedFrom}'s. ${money(proceeds)}.`
      : `Sold ${name} for ${money(proceeds)}.`,
    `val:sold:${owned.id}`,
    'passive',
  );
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      valuables: state.valuables.filter((piece) => piece.id !== owned.id),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
    proceeds,
  });
}

/** A year of everything owned moving in value. Quiet: no feed lines, no ledger. */
export function runValuablesYear(
  valuables: readonly OwnedValuable[],
  year: number,
  seed: string,
): readonly OwnedValuable[] {
  return valuables.map((owned) => {
    const item = findValuable(owned.itemId);
    return item ? valuableYear(owned, item, year, seed) : owned;
  });
}

export interface CollectionShelfView {
  readonly shelf: CollectionShelf;
  readonly pieces: readonly { readonly owned: OwnedValuable; readonly item: Valuable }[];
  /** Whole dollars. */
  readonly worth: number;
}

/** Spec 1893: the collection, sorted onto shelves by itself, dearest first. */
export function collectionOf(state: GameState): readonly CollectionShelfView[] {
  const views: CollectionShelfView[] = [];
  for (const shelf of COLLECTION_SHELVES) {
    const pieces = state.valuables
      .map((owned) => ({ owned, item: findValuable(owned.itemId) }))
      .filter(
        (entry): entry is { owned: OwnedValuable; item: Valuable } => entry.item !== undefined,
      )
      .filter((entry) => shelfOf(entry.item.kind) === shelf)
      .sort((a, b) => Number(b.owned.value) - Number(a.owned.value));
    if (pieces.length === 0) continue;
    views.push({
      shelf,
      pieces,
      worth: pieces.reduce((sum, entry) => sum + Number(entry.owned.value) / 100, 0),
    });
  }
  return views;
}
