import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { VALUABLES, VALUABLE_STORES, findValuable } from '@yearafter/content';
import {
  post,
  reconcile,
  resaleAtPurchase,
  valuableYear,
  REPRODUCTION_SHARE,
  type OwnedValuable,
} from '@yearafter/finance';
import { createNewGame } from './new-game';
import {
  buyValuable,
  iceValuable,
  valuableIcingQuote,
  valuablePurchaseQuote,
  storeStock,
  sellValuable,
  collectionOf,
  runValuablesYear,
} from './shopping';
import { estateOf } from './investments';
import { continueAsChild, heirsIn } from './continue';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
function adult(): GameState {
  const s = createNewGame({ seed: 'p10-commands', startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Test savings',
  });
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: f.ledger,
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    cards: [
      { productId: 'card.private', limit: dollars(100000), balance: dollars(0), status: 'open' },
    ],
  };
}
function holding(itemId = 'val.watch.rolux-subaquatic', value = 9000): GameState {
  const s = adult();
  return {
    ...s,
    valuables: [
      {
        id: 'owned:watch',
        itemId,
        boughtYear: 2020,
        purchasePrice: dollars(10400),
        value: dollars(value),
        inheritedFrom: 'Test grandparent',
      },
    ],
  };
}
function offered(itemId: string) {
  const base = adult();
  for (let year = 2030; year < 2530; year++) {
    const state = { ...base, world: { ...base.world, year } };
    for (const store of VALUABLE_STORES) {
      const piece = storeStock(state, store.id).find((p) => p.item.id === itemId);
      if (piece) return { state, piece };
    }
  }
  throw Error(`No real offer: ${itemId}`);
}
const watches = VALUABLES.filter((v) => v.icing?.kind === 'aftermarket');
describe('P10 paid watch customization through real commands', () => {
  it.each(watches.map((w) => [w.id] as const))(
    'one paid effect and both acquisition paths agree for %s',
    (itemId) => {
      const { state, piece } = offered(itemId);
      const config = piece.item.icing!;
      if (config.kind !== 'aftermarket') throw Error('policy');
      const original = buyValuable(state, piece.id);
      if (!original.ok) throw Error(original.error);
      const rng = state.rng.snapshot();
      const before = JSON.stringify(state);
      const iced = iceValuable(original.value.state, piece.id);
      if (!iced.ok) throw Error(iced.error);
      const expected = dollars(
        Math.max(
          1,
          Math.round(
            resaleAtPurchase(piece.item, piece.price) * config.valueShare +
              config.cost * config.costRecovery,
          ),
        ),
      );
      const ready = buyValuable(state, piece.id, { kind: 'cash' }, 'iced');
      if (!ready.ok) throw Error(ready.error);
      expect(ready.value.piece).toEqual(iced.value.piece);
      expect(ready.value.piece.value).toBe(expected);
      expect(ready.value.piece.purchasePrice).toBe(dollars(piece.price));
      expect(ready.value.piece.icing).toEqual({
        cost: dollars(config.cost),
        year: state.world.year,
      });
      expect(ready.value.state.player.cash).toBe(dollars(100000000 - piece.price - config.cost));
      expect(iced.value.state.player.cash).toBe(ready.value.state.player.cash);
      expect(
        Number(iced.value.piece.value) - Number(original.value.piece.value) - config.cost * 100,
      ).toBeLessThan(0);
      expect(storeStock(ready.value.state, piece.storeId).some((p) => p.id === piece.id)).toBe(
        false,
      );
      expect(buyValuable(ready.value.state, piece.id)).toEqual({
        ok: false,
        error: 'no-such-piece',
      });
      expect(iceValuable(iced.value.state, piece.id)).toEqual({ ok: false, error: 'already-iced' });
      expect(ready.value.state.player.stats).toEqual(state.player.stats);
      expect(ready.value.state.rng.snapshot()).toEqual(rng);
      expect(JSON.stringify(state)).toBe(before);
      expect(reconcile(ready.value.state.finance).ok).toBe(true);
      expect(valuablePurchaseQuote(piece, 'iced')).toEqual({
        ok: true,
        value: {
          base: piece.price,
          work: config.cost,
          total: piece.price + config.cost,
          resale: Number(expected) / 100,
        },
      });
      expect(ready.value.entry.text).toContain((piece.price + config.cost).toLocaleString('en-US'));
    },
  );
  it.each(['cash', 'card'] as const)(
    'keeps ordinary non-watch purchases usable with %s',
    (method) => {
      const { state, piece } = offered('val.ring.signet-gold');
      const result = buyValuable(
        state,
        piece.id,
        method === 'cash' ? { kind: 'cash' } : { kind: 'card', productId: 'card.private' },
      );
      if (!result.ok) throw Error(result.error);
      expect(result.value.piece.icing).toBeUndefined();
      expect(result.value.piece.value).toBe(dollars(resaleAtPurchase(piece.item, piece.price)));
      expect(result.value.state.player.cash).toBe(
        method === 'cash' ? dollars(100000000 - piece.price) : state.player.cash,
      );
      expect(result.value.state.cards[0]!.balance).toBe(
        method === 'cash' ? dollars(0) : dollars(piece.price),
      );
      expect(reconcile(result.value.state.finance).ok).toBe(true);
    },
  );
  it('customizes only the selected piece, preserving every other holding', () => {
    const base = holding();
    const untouched = {
      ...base.valuables[0]!,
      id: 'other:watch',
      itemId: 'val.watch.casiot-g-shok',
      value: dollars(42),
    };
    const state = { ...base, valuables: [...base.valuables, untouched] };
    const result = iceValuable(state, 'owned:watch');
    if (!result.ok) throw Error(result.error);
    expect(result.value.state.valuables[1]).toEqual(untouched);
    expect(result.value.state.valuables[0]!.value).toBe(dollars(5850));
  });
  it('uses current aged resale, preserves provenance and sells/estates only canonical value', () => {
    const s = holding();
    const before = estateOf(s);
    const done = iceValuable(s, 'owned:watch');
    if (!done.ok) throw Error(done.error);
    expect(valuableIcingQuote(s, 'owned:watch')).toEqual({
      ok: true,
      value: { cost: 10000, before: 9000, after: 5850 },
    });
    expect(done.value.piece).toMatchObject({
      id: 'owned:watch',
      boughtYear: 2020,
      purchasePrice: dollars(10400),
      value: dollars(5850),
      inheritedFrom: 'Test grandparent',
    });
    expect(collectionOf(done.value.state)[0]!.worth).toBe(5850);
    expect(Number(estateOf(done.value.state).assets) - Number(before.assets)).toBe(-315000);
    const sold = sellValuable(done.value.state, 'owned:watch');
    if (!sold.ok) throw Error(sold.error);
    expect(sold.value.proceeds).toBe(5850);
    expect(sold.value.state.valuables).toHaveLength(0);
    expect(sold.value.entry.text).toContain("Test grandparent's");
    expect(reconcile(sold.value.state.finance).ok).toBe(true);
  });
  it('preserves original cash receipt and annual valuation; factory-set and smartwatch cannot be modified', () => {
    const { state, piece } = offered('val.watch.jakob-timeless-treasure');
    const bought = buyValuable(state, piece.id);
    if (!bought.ok) throw Error(bought.error);
    expect(bought.value.entry.text).toBe(
      `Bought a Jakob & Co. Billionaire Timeless Treasure for $${piece.price.toLocaleString('en-US')}.`,
    );
    expect(bought.value.piece.icing).toBeUndefined();
    expect(iceValuable(bought.value.state, piece.id)).toEqual({
      ok: false,
      error: 'not-customizable',
    });
    expect(buyValuable(state, piece.id, { kind: 'cash' }, 'iced')).toEqual({
      ok: false,
      error: 'not-customizable',
    });
    expect(iceValuable(holding('val.watch.apple-ish'), 'owned:watch')).toEqual({
      ok: false,
      error: 'not-customizable',
    });
    expect(iceValuable(holding('unknown.retired-watch'), 'owned:watch')).toEqual({
      ok: false,
      error: 'not-customizable',
    });
    expect(iceValuable(state, 'missing')).toEqual({ ok: false, error: 'no-such-piece' });
    expect(buyValuable({ ...state, player: { ...state.player, age: 15 } }, piece.id)).toEqual({
      ok: false,
      error: 'too-young',
    });
  });
  it('charges the full ready invoice on a card, without touching cash, and records funding as transfer', () => {
    const { state, piece } = offered('val.watch.rolux-subaquatic');
    const cost = piece.price + 10000;
    const r = buyValuable(
      state,
      piece.id,
      { kind: 'card', productId: 'card.private', expectedTotal: dollars(cost) },
      'iced',
    );
    if (!r.ok) throw Error(r.error);
    expect(r.value.state.cards[0]!.balance).toBe(dollars(cost));
    expect(r.value.state.player.cash).toBe(state.player.cash);
    expect(r.value.state.finance.transactions.slice(-2).map((t) => [t.category, t.amount])).toEqual(
      [
        ['debt', dollars(cost)],
        ['property', dollars(-cost)],
      ],
    );
    expect(r.value.entry.text).toContain('Paid with Private Client Card.');
    expect(reconcile(r.value.state.finance).ok).toBe(true);
    const custom = iceValuable(holding(), 'owned:watch', {
      kind: 'card',
      productId: 'card.private',
    });
    if (!custom.ok) throw Error(custom.error);
    expect(custom.value.state.cards[0]!.balance).toBe(dollars(10000));
    expect(custom.value.state.player.cash).toBe(state.player.cash);
  });
  it.each(['stale', 'missing', 'frozen', 'short', 'cash'] as const)(
    'refuses %s atomically for purchase and customization',
    (reason) => {
      const { state: offeredState, piece } = offered('val.watch.rolux-subaquatic');
      for (const custom of [false, true]) {
        let state = custom ? holding() : offeredState;
        const total = custom ? 10000 : piece.price + 10000;
        let payment: {
          kind: 'cash' | 'card';
          productId: string;
          expectedTotal?: ReturnType<typeof dollars>;
        } = { kind: 'card', productId: 'card.private', expectedTotal: dollars(total) };
        if (reason === 'stale') payment = { ...payment, expectedTotal: dollars(total + 1) };
        if (reason === 'missing') state = { ...state, cards: [] };
        if (reason === 'frozen')
          state = { ...state, cards: [{ ...state.cards[0]!, status: 'frozen' }] };
        if (reason === 'short')
          state = {
            ...state,
            cards: [{ ...state.cards[0]!, balance: dollars(100000 - total + 1) }],
          };
        if (reason === 'cash') {
          state = {
            ...state,
            finance: { ...state.finance, balance: dollars(0) },
            player: { ...state.player, cash: dollars(0) },
          };
          payment = { kind: 'cash', productId: '' };
        }
        const before = JSON.stringify(state);
        const rng = state.rng.snapshot();
        const r = custom
          ? iceValuable(state, 'owned:watch', payment)
          : buyValuable(state, piece.id, payment, 'iced');
        expect(r).toEqual({
          ok: false,
          error:
            reason === 'stale'
              ? 'payment-price-changed'
              : reason === 'missing'
                ? 'payment-card-missing'
                : reason === 'frozen'
                  ? 'payment-card-frozen'
                  : reason === 'short'
                    ? 'payment-credit-short'
                    : custom
                      ? 'payment-cash-short'
                      : 'cannot-afford',
        });
        expect(JSON.stringify(state)).toBe(before);
        expect(state.rng.snapshot()).toEqual(rng);
      }
    },
  );
  it('keeps hidden counterfeit flags, then uses the ordinary appraisal; rejects known reproductions', () => {
    const base = holding();
    const s = { ...base, valuables: [{ ...base.valuables[0]!, fake: true }] };
    const r = iceValuable(s, 'owned:watch');
    if (!r.ok) throw Error(r.error);
    expect(r.value.piece.fake).toBe(true);
    expect(r.value.piece.inheritedFrom).toBe('Test grandparent');
    const next = runValuablesYear([r.value.piece], 2031, 'fake')[0]!;
    expect(next.fake).toBeUndefined();
    expect(next.reproduction).toBe(true);
    expect(next.icing).toEqual(r.value.piece.icing);
    expect(next.value).toBe(dollars(Math.max(1, Math.round(5850 * REPRODUCTION_SHARE))));
    expect(
      iceValuable(
        { ...s, valuables: [{ ...s.valuables[0]!, fake: undefined, reproduction: true }] },
        'owned:watch',
      ),
    ).toEqual({ ok: false, error: 'known-reproduction' });
  });
  it('uses precious annual movement and $1 floor with no repeated modifier or charge', () => {
    const s = holding('val.watch.casiot-g-shok', 42);
    const r = iceValuable(s, 'owned:watch');
    if (!r.ok) throw Error(r.error);
    const item = findValuable(r.value.piece.itemId)!;
    let actual = r.value.piece;
    let control: OwnedValuable = { ...actual, icing: undefined };
    for (let year = 2031; year < 2041; year++) {
      actual = runValuablesYear([actual], year, 'annual')[0]!;
      control = valuableYear(control, { ...item, holds: 'precious' }, year, 'annual');
      expect(actual.value).toBe(control.value);
      expect(actual.icing).toEqual(r.value.piece.icing);
    }
    const low = { ...actual, value: dollars(1) };
    expect(valuableYear(low, item, 2031, 'floor').value).toBe(dollars(1));
    for (const id of ['val.watch.rolux-subaquatic', 'val.watch.jakob-timeless-treasure']) {
      const original = holding(id).valuables[0]!;
      expect(runValuablesYear([original], 2031, 'annual')[0]!.value).toBe(
        dollars(id === 'val.watch.rolux-subaquatic' ? 9073 : 8912),
      );
      expect(runValuablesYear([original], 2031, 'annual')[0]).toEqual(
        valuableYear(original, findValuable(id)!, 2031, 'annual'),
      );
    }
    expect(r.value.state.finance.transactions).toHaveLength(s.finance.transactions.length + 1);
  });
  it('hands paid work and base cost to an actual descendant with owner provenance', () => {
    let dead: GameState | undefined;
    for (let seed = 0; seed < 30 && !dead; seed++) {
      let s = createNewGame({ seed: `p10-heir:${seed}` });
      for (let y = 0; y < 120 && s.player.alive; y++) {
        let guard = 0;
        while (s.pending.length && guard++ < 20) {
          const d = s.pending[0]!;
          const r = decide(s, d.eventId, d.choices[0]!.id);
          if (!r.ok) break;
          s = r.value.state;
        }
        s = advanceYear(s).state;
      }
      if (!s.player.alive && heirsIn(s.family).length) dead = s;
    }
    expect(dead).toBeDefined();
    const piece: OwnedValuable = {
      ...holding().valuables[0]!,
      icing: { cost: dollars(10000), year: 2025 },
      value: dollars(5850),
    };
    const heir = continueAsChild({ ...dead!, valuables: [piece] }, heirsIn(dead!.family)[0]!.id)!;
    expect(heir.valuables[0]).toEqual({
      ...piece,
      inheritedFrom: `${dead!.player.firstName} ${dead!.player.lastName}`,
    });
    expect(reconcile(heir.finance).ok).toBe(true);
  });
});
