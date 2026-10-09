import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { VALUABLES } from '@yearafter/content';
import { post, reconcile, valuableYear } from '@yearafter/finance';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';
import { estateOf } from './investments';
import { buyValuable, sellValuable, storeStock, collectionOf } from './shopping';

const additions = VALUABLES.slice(151);
function funded(seed: string, cash: number): GameState {
  const s = createNewGame({ seed });
  const books = post(s.finance, 1999, 30, {
    category: 'gift',
    amount: dollars(cash),
    source: 'P8 measurement funds',
  });
  return {
    ...s,
    finance: books.ledger,
    player: { ...s.player, age: 30, cash: books.ledger.balance },
  };
}
function offered(itemId: string, cash = 50000000) {
  const base = funded('p8-purchases', cash);
  for (let year = 2000; year < 2500; year++) {
    const state = { ...base, world: { ...base.world, year } };
    for (const store of ['store.watches', 'store.maison']) {
      const piece = storeStock(state, store).find((p) => p.item.id === itemId);
      if (piece) return { state, piece };
    }
  }
  throw Error(`Unreachable catalog item: ${itemId}`);
}

describe('P8 — new models through the real shopping, collection and money commands', () => {
  it.each(additions.map((v) => [v.id] as const))('buys, values, shelves and sells %s', (id) => {
    const { state, piece } = offered(id);
    const rng = state.rng.snapshot();
    const bought = buyValuable(state, piece.id);
    if (!bought.ok) throw Error(bought.error);
    const after = bought.value.state;
    const share = [
      'val.watch.rolux-perpetual',
      'val.watch.rolux-explorer',
      'val.watch.patrek-aquanote',
    ].includes(id)
      ? 1.15
      : 0.75;
    const value = Math.round(piece.price * share);
    expect(after.player.cash).toBe(dollars(50000000 - piece.price));
    expect(bought.value.piece).toMatchObject({
      itemId: id,
      purchasePrice: dollars(piece.price),
      value: dollars(value),
    });
    expect(after.finance.transactions.at(-1)).toMatchObject({
      category: 'property',
      amount: dollars(-piece.price),
    });
    expect(reconcile(after.finance).ok).toBe(true);
    expect(Number(estateOf(after).assets) - Number(estateOf(state).assets)).toBe(value * 100);
    expect(
      collectionOf(after)
        .find((s) => s.shelf === 'watches')
        ?.pieces.map((p) => p.item.id),
    ).toContain(id);
    expect(storeStock(after, piece.storeId).some((p) => p.id === piece.id)).toBe(false);
    expect(buyValuable(after, piece.id)).toEqual({ ok: false, error: 'no-such-piece' });
    expect(after.rng.snapshot()).toEqual(rng);
    const next = valuableYear(bought.value.piece, piece.item, state.world.year + 1, 'p8-purchases');
    expect(next.itemId).toBe(id);
    expect(Number(next.value)).toBeGreaterThan(0);
    expect(next).toEqual(
      valuableYear(bought.value.piece, piece.item, state.world.year + 1, 'p8-purchases'),
    );
    const sold = sellValuable(after, bought.value.piece.id);
    if (!sold.ok) throw Error(sold.error);
    expect(sold.value.proceeds).toBe(value);
    expect(sold.value.state.player.cash).toBe(dollars(50000000 - piece.price + value));
    expect(sold.value.state.valuables).toHaveLength(0);
    expect(reconcile(sold.value.state.finance).ok).toBe(true);
  });
  it('keeps the $20m model behind existing means gates and refuses a cash-short purchase', () => {
    const id = 'val.watch.jakob-timeless-treasure';
    for (let year = 2000; year < 2100; year++) {
      const base = funded('p8-gates', 1000000);
      const state = { ...base, world: { ...base.world, year } };
      expect(storeStock(state, 'store.maison').some((p) => p.item.id === id)).toBe(false);
      expect(storeStock(state, 'store.watches').some((p) => p.item.id === id)).toBe(false);
    }
    const { state, piece } = offered(id, 14000000);
    expect(buyValuable(state, piece.id)).toEqual({ ok: false, error: 'cannot-afford' });
    expect(state.valuables).toHaveLength(0);
    expect(reconcile(state.finance).ok).toBe(true);
  });
  it('keeps counters deterministic, distinct and RNG-free after catalog growth', () => {
    const state = funded('p8-counter', 50000000);
    const before = state.rng.snapshot();
    for (const store of ['store.watches', 'store.maison']) {
      const rows = storeStock(state, store);
      expect(rows).toHaveLength(store === 'store.watches' ? 6 : 5);
      expect(storeStock(state, store)).toEqual(rows);
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
      expect(new Set(rows.map((r) => r.item.id)).size).toBe(rows.length);
    }
    expect(state.rng.snapshot()).toEqual(before);
  });
});
