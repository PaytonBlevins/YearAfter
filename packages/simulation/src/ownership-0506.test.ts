/**
 * Ticket 0506 acceptance tests — renovations, shopping and the collection.
 *
 * Measured before this ticket on two disjoint sets of 150 lives: 72–76% of the
 * homes people lived in at 45–64 were in poor condition, and 86–88% past
 * sixty-five, because nothing could ever lift one. And nobody owned a single
 * piece of jewelry, a watch or a painting: Shopping and Valuable Collections
 * had said "not built yet" since 0108.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { VALUABLE_STORES } from '@yearafter/content';
import { reconcile } from '@yearafter/finance';
import { advanceYear } from './advance';
import { continueAsChild, heirsIn } from './continue';
import { decide } from './decide';
import type { GameState } from './game-state';
import { estateOf } from './investments';
import { createNewGame } from './new-game';
import { renovate, renovationOptionsFor } from './renovations';
import {
  MYTHICAL_CHANCE,
  buyValuable,
  collectionOf,
  openStores,
  sellValuable,
  shoppingMeansOf,
  storeStock,
} from './shopping';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

function topUp(state: GameState, amount: number): GameState {
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${amount}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
}

const netWorthOf = (state: GameState): number => {
  const estate = estateOf(state);
  return (
    Number(state.player.cash) +
    Number(estate.investments) +
    Number(estate.assets ?? 0) -
    Number(estate.liabilities)
  );
};

/* -------------------------------------------------------------------------- */
/* One population                                                              */
/* -------------------------------------------------------------------------- */

interface Row {
  readonly age: number;
  readonly condition?: string;
  readonly netWorth: number;
}

const ROWS: Row[] = [];
const OWNERS: GameState[] = [];
const DEAD: GameState[] = [];

for (let i = 0; i < 150; i += 1) {
  let state = createNewGame({ seed: `own6-${i}` });
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    if (state.player.age < 25) continue;
    const home = state.homes.find((candidate) => !candidate.letting);
    if (home && OWNERS.length < 40 && state.player.age >= 40) OWNERS.push(state);
    ROWS.push({
      age: state.player.age,
      ...(home ? { condition: home.condition } : {}),
      netWorth: netWorthOf(state) / 100,
    });
  }
  if (!state.player.alive) DEAD.push(state);
}

const band = (low: number, high: number) => ROWS.filter((row) => row.age >= low && row.age <= high);
const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const poorShare = (rows: readonly Row[]) => {
  const owners = rows.filter((row) => row.condition);
  return owners.filter((row) => row.condition === 'poor').length / Math.max(1, owners.length);
};

describe('0506 — the seventh door: a home falling apart', () => {
  it('keeps the homes people live in from all ending up poor', () => {
    // Before: 72–76% at 45–64 and 86–88% past 65.
    expect(poorShare(band(45, 64))).toBeLessThan(0.45);
    expect(poorShare(band(65, 99))).toBeLessThan(0.45);
    // And it is not a renovation spree: plenty are still only fair.
    const owners = band(45, 99).filter((row) => row.condition);
    expect(
      owners.filter((row) => row.condition === 'excellent').length / owners.length,
    ).toBeLessThan(0.15);
  });

  it('pays for itself in the value it keeps: net worth stays where it was', () => {
    // Before 0506 (two samples): 45–64 $236,000–$254,000; 65+ $440,000–$454,000.
    expect(median(band(45, 64).map((row) => row.netWorth))).toBeGreaterThan(190_000);
    expect(median(band(65, 99).map((row) => row.netWorth))).toBeGreaterThan(340_000);
  });
});

describe('0506 — renovating by hand', () => {
  const owner = topUp(OWNERS[0]!, 300_000);
  const home = owner.homes.find((candidate) => !candidate.letting)!;

  it('lists only what the home has room for, with a cost and what it would be worth', () => {
    const options = renovationOptionsFor(owner, home.id);
    expect(options.length).toBeGreaterThan(3);
    for (const option of options) {
      expect(option.refusal).not.toBe('notForThisHome');
      expect(option.cost).toBeGreaterThan(0);
    }
  });

  it('charges the builder as housing, and the home keeps part of it as value', () => {
    const option = renovationOptionsFor(owner, home.id).find(
      (candidate) => !candidate.renovation.refresh && candidate.refusal === undefined,
    )!;
    const before = netWorthOf(owner);
    const done = renovate(owner, home.id, option.renovation.id);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(reconcile(done.value.state.finance).ok).toBe(true);
    expect(done.value.state.finance.transactions.at(-1)?.category).toBe('housing');
    const lost = before - netWorthOf(done.value.state);
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(option.cost * 100);
    expect(renovate(done.value.state, home.id, option.renovation.id).ok).toBe(false);
  });
});

describe('0506 — shopping', () => {
  const adult = OWNERS[1]!;
  const rich = topUp(adult, 3_000_000);

  it('shows the same counter all year and a new one the next', () => {
    const counter = storeStock(adult, 'store.watches');
    expect(counter.length).toBeGreaterThan(0);
    expect(storeStock(adult, 'store.watches')).toEqual(counter);
    const later = { ...adult, world: { ...adult.world, year: adult.world.year + 1 } };
    expect(storeStock(later, 'store.watches').map((piece) => piece.item.id)).not.toEqual(
      counter.map((piece) => piece.item.id),
    );
  });

  it('opens the appointment-only store behind a gate it never names', () => {
    const broke = { ...adult, player: { ...adult.player, cash: 0 as never }, prices: adult.prices };
    if (shoppingMeansOf(broke) < 150_000) {
      expect(openStores(broke).map((store) => store.id)).not.toContain('store.maison');
    }
    expect(openStores(rich).map((store) => store.id)).toContain('store.maison');
    // And never a painting that costs a house to somebody with nothing.
    for (const piece of storeStock(broke, 'store.gallery'))
      expect(piece.price).toBeLessThan(1_000_000);
  });

  it('buys as a transfer, worth less than retail the day it is yours, and sells with one button', () => {
    const piece = storeStock(rich, 'store.jeweler')[0]!;
    const before = netWorthOf(rich);
    const bought = buyValuable(rich, piece.id);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const after = bought.value.state;
    expect(reconcile(after.finance).ok).toBe(true);
    expect(after.finance.transactions.at(-1)?.category).toBe('property');
    // Worth less than was paid the moment it is yours — but still worth
    // something, and counted (spec 140).
    expect(before - netWorthOf(after)).toBeGreaterThan(0);
    expect(before - netWorthOf(after)).toBeLessThan(piece.price * 100);
    expect(storeStock(after, 'store.jeweler').some((left) => left.id === piece.id)).toBe(false);
    expect(collectionOf(after).flatMap((shelf) => shelf.pieces).length).toBe(1);
    const sold = sellValuable(after, bought.value.piece.id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.proceeds * 100).toBe(Number(bought.value.piece.value));
    expect(sold.value.state.valuables).toHaveLength(0);
    expect(reconcile(sold.value.state.finance).ok).toBe(true);
  });

  it('sorts a collection onto its shelves by itself, dearest first', () => {
    let state = rich;
    for (const storeId of ['store.watches', 'store.gallery', 'store.antiques']) {
      const piece = storeStock(state, storeId)[0];
      if (!piece) continue;
      const bought = buyValuable(state, piece.id);
      if (bought.ok) state = bought.value.state;
    }
    const shelves = collectionOf(state);
    expect(shelves.length).toBeGreaterThanOrEqual(2);
    for (const shelf of shelves) {
      for (let i = 1; i < shelf.pieces.length; i += 1) {
        expect(Number(shelf.pieces[i - 1]!.owned.value)).toBeGreaterThanOrEqual(
          Number(shelf.pieces[i]!.owned.value),
        );
      }
    }
    // A year later it is all still there, worth something different.
    const next = advanceYear(state).state;
    expect(next.valuables.map((piece) => piece.id)).toEqual(
      state.valuables.map((piece) => piece.id),
    );
    expect(next.valuables.map((piece) => piece.value)).not.toEqual(
      state.valuables.map((piece) => piece.value),
    );
  });

  it('almost never shows a legend (spec 1249: extremely rare)', () => {
    let seen = 0;
    let slots = 0;
    const store = VALUABLE_STORES.find((candidate) => candidate.id === 'store.antiques')!;
    for (let year = 0; year < 400; year += 1) {
      const later = { ...rich, world: { ...rich.world, year: rich.world.year + year } };
      const counter = storeStock(later, 'store.antiques');
      slots += store.size;
      seen += counter.filter((piece) => piece.item.kind === 'mythical').length;
    }
    // 2,800 slots: about one legend at the intended rate, never a handful.
    expect(slots).toBe(2_800);
    expect(seen).toBeLessThanOrEqual(3);
    expect(MYTHICAL_CHANCE).toBeLessThan(0.001);
  });

  it('passes the collection to an heir as things, not money, and remembers whose it was', () => {
    const dead = DEAD.find((state) => heirsIn(state.family).length > 0)!;
    const piece = {
      id: 'val:2050:store.watches:0',
      itemId: 'val.watch.rolux-subaquatic',
      boughtYear: 2050,
      purchasePrice: dollars(10_250),
      value: dollars(12_000),
    };
    const withWatch: GameState = { ...dead, valuables: [piece] };
    const heir = continueAsChild(withWatch, heirsIn(dead.family)[0]!.id)!;
    expect(heir.valuables).toHaveLength(1);
    expect(heir.valuables[0]!.inheritedFrom).toBe(
      `${dead.player.firstName} ${dead.player.lastName}`,
    );
    expect(heir.finance.transactions.some((entry) => entry.source.includes('Rolux'))).toBe(false);
    expect(reconcile(heir.finance).ok).toBe(true);
  });
});
