import { describe, it, expect } from 'vitest';
import { cents, dollars, mixedUnit } from '@yearafter/core';
import { findVehicleTrim } from '@yearafter/content';
import {
  post,
  reconcile,
  availableOn,
  vehicleSaleOf,
  summariseFinances,
  vehicleYear,
} from '@yearafter/finance';
import {
  createNewGame,
  serviceVehicle,
  vehicleServiceQuote,
  runVehiclesYear,
  advanceYear,
  vehicleLots,
  buyVehicle,
  estateOf,
  continueAsChild,
  heirsIn,
  decide,
  type GameState,
} from './index';
export function fixture(cash = 10000): GameState {
  const s = createNewGame({ seed: 'p11-command', startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(cash),
    source: 'Savings',
  });
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: f.ledger,
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    cards: [
      { productId: 'card.private', limit: dollars(10000), balance: dollars(0), status: 'open' },
    ],
    vehicles: [
      {
        id: 'p11-car',
        trimId: 'car.royata-camden.se',
        modelYear: 2030,
        boughtYear: 2030,
        purchasePrice: dollars(31500),
        value: dollars(29000),
        condition: 100,
        history: 'full',
        accident: false,
        behindYears: 0,
      },
    ],
  };
}
function paid(s = fixture(), method: 'cash' | 'card' = 'cash') {
  const r = serviceVehicle(
    s,
    'p11-car',
    method === 'cash'
      ? { kind: 'cash', expectedTotal: dollars(230) }
      : { kind: 'card', productId: 'card.private', expectedTotal: dollars(230) },
  );
  if (!r.ok) throw Error(r.error);
  return r.value;
}
describe('P11 actual servicing commands and annual reader', () => {
  it.each(['cash', 'card'] as const)(
    'atomically pays full invoice with %s and records service',
    (method) => {
      const s = fixture();
      const before = JSON.stringify(s);
      const rngBefore = JSON.stringify(s.rng.snapshot());
      const r = paid(s, method);
      expect(r.vehicle.service).toEqual({ year: 2030, cost: 230 });
      expect(r.state.player.cash).toBe(dollars(method === 'cash' ? 9770 : 10000));
      expect(r.state.finance.balance).toBe(r.state.player.cash);
      expect(r.state.cards[0]?.balance).toBe(dollars(method === 'card' ? 230 : 0));
      expect(availableOn(r.state.cards[0]!)).toBe(dollars(method === 'card' ? 9770 : 10000));
      expect(
        r.state.finance.transactions
          .filter((t) => t.year === 2030 && t.category === 'vehicle')
          .map((t) => t.amount),
      ).toEqual([dollars(-230)]);
      expect(
        r.state.finance.transactions.filter((t) => t.year === 2030 && t.category === 'debt').length,
      ).toBe(method === 'card' ? 1 : 0);
      expect(r.state.player.timeline.at(-1)).toEqual(r.entry);
      expect(r.entry.text).toContain('$230');
      expect(JSON.stringify(r.state.rng.snapshot())).toBe(rngBefore);
      expect(r.vehicle).toEqual({ ...s.vehicles[0], service: { year: 2030, cost: 230 } });
      expect(r.state.player.stats).toEqual(s.player.stats);
      expect(reconcile(r.state.finance).ok).toBe(true);
      expect(JSON.stringify(s)).toBe(before);
      expect(JSON.stringify(s.rng.snapshot())).toBe(rngBefore);
    },
  );
  it('does not restore a tired car, its old records, accident, value or stats immediately', () => {
    const s = fixture();
    const state = {
      ...s,
      vehicles: s.vehicles.map((v) => ({
        ...v,
        condition: 70,
        history: 'none' as const,
        accident: true,
        value: dollars(12345),
      })),
    };
    const r = paid(state);
    expect(r.vehicle).toEqual({ ...state.vehicles[0], service: { year: 2030, cost: 230 } });
    expect(r.state.player.stats).toEqual(state.player.stats);
  });
  it('cash can cover the exact invoice and card can work with no cash', () => {
    expect(paid(fixture(230)).state.player.cash).toBe(dollars(0));
    expect(paid(fixture(0), 'card').state.player.cash).toBe(dollars(0));
  });
  it('borrowed service money stays a transfer and the bill is an expense', () => {
    const s = paid(fixture(), 'card').state;
    const sum = summariseFinances(s.finance, 2030, estateOf(s));
    expect(sum.income).toBe(dollars(0));
    expect(sum.monthlyOutflow).toBe(cents(1917));
  });
  it.each([
    ['not-alive', (s: GameState) => ({ ...s, player: { ...s.player, alive: false } })],
    ['too-young', (s: GameState) => ({ ...s, player: { ...s.player, age: 17 } })],
    ['no-such-car', (s: GameState) => ({ ...s, vehicles: [] })],
    [
      'unsupported-car',
      (s: GameState) => ({ ...s, vehicles: s.vehicles.map((v) => ({ ...v, trimId: 'retired' })) }),
    ],
    ['already-serviced', (s: GameState) => paid(s).state],
    [
      'already-serviced',
      (s: GameState) => ({
        ...s,
        vehicles: s.vehicles.map((v) => ({ ...v, service: { year: 2031, cost: 230 } })),
      }),
    ],
  ] as const)('refuses %s with no mutation or draw', (reason, change) => {
    const s = change(fixture());
    const before = JSON.stringify(s);
    const rngBefore = JSON.stringify(s.rng.snapshot());
    expect(serviceVehicle(s, 'p11-car')).toEqual({ ok: false, error: reason });
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(s.rng.snapshot())).toBe(rngBefore);
  });
  it.each([
    'payment-cash-short',
    'payment-card-missing',
    'payment-card-frozen',
    'payment-credit-short',
    'payment-price-changed',
  ] as const)('refuses %s before any partial payment', (reason) => {
    let s = fixture(reason === 'payment-cash-short' ? 229 : 10000);
    if (reason === 'payment-card-missing') s = { ...s, cards: [] };
    if (reason === 'payment-card-frozen')
      s = { ...s, cards: s.cards.map((c) => ({ ...c, status: 'frozen' })) };
    if (reason === 'payment-credit-short')
      s = { ...s, cards: s.cards.map((c) => ({ ...c, balance: dollars(9771) })) };
    const before = JSON.stringify(s);
    const rngBefore = JSON.stringify(s.rng.snapshot());
    const method =
      reason === 'payment-cash-short'
        ? { kind: 'cash' as const }
        : {
            kind: 'card' as const,
            productId: 'card.private',
            ...(reason === 'payment-price-changed' ? { expectedTotal: dollars(220) } : {}),
          };
    expect(serviceVehicle(s, 'p11-car', method)).toEqual({ ok: false, error: reason });
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(s.rng.snapshot())).toBe(rngBefore);
  });
  it('affects only the selected car, cannot stack, and renews next year', () => {
    const s = fixture();
    const other = { ...s.vehicles[0]!, id: 'other' };
    const r = paid({ ...s, vehicles: [...s.vehicles, other] });
    expect(r.state.vehicles[1]).toEqual(other);
    expect(serviceVehicle(r.state, 'p11-car').ok).toBe(false);
    const next = { ...r.state, world: { ...r.state.world, year: 2031 } };
    expect(vehicleServiceQuote(next, 'p11-car').ok).toBe(true);
    const renewed = serviceVehicle(next, 'p11-car');
    if (!renewed.ok) throw Error(renewed.error);
    expect(renewed.value.vehicle.service?.year).toBe(2031);
    expect(renewed.value.entry.id).not.toBe(r.entry.id);
  });
  it('uses exact keyed production inputs with one unchanged ordinary bill', () => {
    const r = paid();
    const v = r.vehicle;
    const f = findVehicleTrim(v.trimId);
    if (!f) throw Error('trim');
    const seed = r.state.rng.getSeed();
    const roll = (key: string) => mixedUnit(`${seed}:${v.id}:2031:${key}`);
    const expected = vehicleYear(v, f, 2031, {
      wear: roll('wear'),
      upkeep: roll('upkeep'),
      repair: roll('repair'),
      repairSize: roll('repair-size'),
      accident: roll('accident'),
    });
    const actual = runVehiclesYear([v], 2031, seed);
    expect(actual.vehicles[0]).toEqual(expected.vehicle);
    expect(actual.cost).toBe(expected.maintenance + expected.payment);
    expect(actual.transactions.filter((t) => t.category === 'vehicle')).toHaveLength(1);
    const full = advanceYear(r.state).state;
    expect(full.vehicles[0]?.condition).toBe(expected.vehicle.condition);
    expect(reconcile(full.finance).ok).toBe(true);
    expect(
      full.finance.transactions.filter((t) => t.year === 2030 && t.category === 'vehicle'),
    ).toHaveLength(1);
    expect(
      full.finance.transactions.filter((t) => t.year === 2031 && t.category === 'vehicle').length,
    ).toBe(1);
  });
  it('works on a real purchased offer rather than only a synthetic car', () => {
    const funded = fixture(100000);
    const s = { ...funded, vehicles: [] };
    const offer = vehicleLots(s, 'new').flatMap((l) => l.listings)[0];
    if (!offer) throw Error('offer');
    const buy = buyVehicle(s, offer.id, 'cash');
    if (!buy.ok) throw Error(buy.error);
    const q = vehicleServiceQuote(buy.value.state, offer.id);
    if (!q.ok) throw Error(q.error);
    const r = serviceVehicle(buy.value.state, offer.id, {
      kind: 'cash',
      expectedTotal: dollars(q.value.cost),
    });
    if (!r.ok) throw Error(r.error);
    expect(r.value.vehicle.history).toBe(buy.value.vehicle.history);
    expect(r.value.vehicle.condition).toBe(buy.value.vehicle.condition);
    expect(reconcile(r.value.state.finance).ok).toBe(true);
  });
  it('liquidates a serviced car for an actual descendant without transferring coverage', () => {
    let dead: GameState | undefined;
    for (let seed = 0; seed < 30 && !dead; seed++) {
      let s = createNewGame({ seed: `p11-heir:${seed}` });
      for (let y = 0; y < 120 && s.player.alive; y++) {
        let guard = 0;
        while (s.pending.length && guard++ < 20) {
          const decision = s.pending[0];
          const choice = decision?.choices[0];
          if (!decision || !choice) throw Error('decision');
          const r = decide(s, decision.eventId, choice.id);
          if (!r.ok) throw Error(r.error);
          s = r.value.state;
        }
        s = advanceYear(s).state;
      }
      if (!s.player.alive && heirsIn(s.family).length) dead = s;
    }
    if (!dead) throw Error('No actual heir');
    const v = paid().vehicle;
    const heirId = heirsIn(dead.family)[0]?.id;
    if (!heirId) throw Error('heir');
    const a = continueAsChild({ ...dead, vehicles: [v] }, heirId);
    const b = continueAsChild({ ...dead, vehicles: [{ ...v, service: undefined }] }, heirId);
    if (!a || !b) throw Error('handoff');
    expect(a.vehicles).toEqual([]);
    expect(a.finance).toEqual(b.finance);
    expect(
      a.finance.transactions.some(
        (t) => t.source.includes('car') && t.amount === dollars(vehicleSaleOf(v).proceeds),
      ),
    ).toBe(true);
    expect(reconcile(a.finance).ok).toBe(true);
  });
});
