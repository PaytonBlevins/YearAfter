import { describe, expect, it } from 'vitest';
import { asSaveId, cents, dollars } from '@yearafter/core';
import { buyValuable, createNewGame, openStores, storeStock } from '@yearafter/simulation';
import { reconcile, runCardYear } from '@yearafter/finance';
import { fromSave, toSave } from './serialize';
import { CURRENT_SAVE_VERSION } from './save-schema';
describe('card purchase persistence', () => {
  it('round-trips the asset, debt, receipt and ledger through the existing save', () => {
    const fresh = createNewGame({ seed: 'card-purchase-save' });
    const state = {
      ...fresh,
      player: { ...fresh.player, age: 35 },
      cards: [
        {
          productId: 'card.starter',
          limit: dollars(10000),
          balance: cents(0),
          status: 'open' as const,
        },
      ],
    };
    const piece = openStores(state).flatMap((store) => storeStock(state, store.id))[0];
    if (!piece) throw new Error('No piece');
    const bought = buyValuable(state, piece.id, { kind: 'card', productId: 'card.starter' });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const saved = toSave(bought.value.state, {
      id: asSaveId('card-purchase'),
      createdAt: 1,
      updatedAt: 2,
    });
    expect(saved.version).toBe(CURRENT_SAVE_VERSION);
    const restored = fromSave(JSON.parse(JSON.stringify(saved)));
    expect(restored.valuables).toEqual(bought.value.state.valuables);
    expect(restored.cards).toEqual(bought.value.state.cards);
    expect(restored.player.timeline).toEqual(bought.value.state.player.timeline);
    expect(restored.finance).toEqual(bought.value.state.finance);
    expect(restored.player.cash).toBe(state.player.cash);
    expect(reconcile(restored.finance).ok).toBe(true);
    expect(runCardYear(restored.cards, 0).interest).toBeGreaterThan(0);
    expect(buyValuable(restored, piece.id, { kind: 'card', productId: 'card.starter' }).ok).toBe(
      false,
    );
  });
});
