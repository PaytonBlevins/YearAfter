import { describe, it, expect } from 'vitest';
import { dollars } from '@yearafter/core';
import { INSTRUMENTS, VEHICLE_MODELS } from '@yearafter/content';
import { priceOf, reconcile, runCardYear, runLoanYear } from '@yearafter/finance';
import { createNewGame } from './new-game';
import {
  actOnAdvice,
  adviceFor,
  advisorCashFor,
  advicePreviewFor,
  setCashGoal,
} from './investments';
import { mortgageLineOf } from './homes';
import { upkeepOf } from './vehicles';
import {
  annualExpenseOf,
  vehicleLoanPayments,
  type OwnedHome,
  type OwnedVehicle,
} from '@yearafter/finance';
import { livingEstimateFor } from './lifestyle';
import { post } from '@yearafter/finance';
import type { GameState } from './game-state';
const fixture = (cash = 86000): GameState => {
  const b = createNewGame({ seed: 'p7-test' });
  const posted = post(b.finance, b.world.year, 30, {
    category: 'salary',
    amount: dollars(cash),
    source: 'Test funding',
  });
  return {
    ...b,
    player: { ...b.player, age: 30, cash: posted.ledger.balance },
    finance: posted.ledger,
    advisorId: 'adv.independent',
  };
};
const withHoldings = (s: GameState, ids: string[], values: number[]): GameState => ({
  ...s,
  portfolio: ids.map((id, i) => ({
    instrumentId: id,
    units: (values[i]! * 100) / priceOf(s.prices, id),
    paid: dollars(values[i]!),
  })),
});
const bonds = 'fd.bondfund';
describe('P7 actual advisor actions', () => {
  it('puts idle cash into the explicit broad index and preserves the reserve', () => {
    const s = fixture();
    const rec = adviceFor(s).find((r) => r.reason === 'idleCash')!;
    const r = actOnAdvice(s, rec.id);
    if (!r.ok) throw Error(r.error);
    expect(r.value.state.portfolio[0]!.instrumentId).toBe('fd.broadindex');
    expect(Number(s.player.cash) - Number(r.value.state.player.cash)).toBeLessThanOrEqual(
      advisorCashFor(s).spare * 0.15 * 100,
    );
    expect(Number(r.value.state.player.cash) / 100).toBeGreaterThanOrEqual(
      advisorCashFor(s).reserve,
    );
    expect(reconcile(r.value.state.finance).ok).toBe(true);
  });
  it.each(['noFloor', 'concentrated'] as const)(
    'sells only the %s risk, keeping the safe holding',
    (reason) => {
      const ids = INSTRUMENTS.filter((i) =>
        reason === 'noFloor'
          ? i.kind === 'crypto'
          : i.kind === 'stock' && i.sector === 'technology',
      )
        .slice(0, 3)
        .map((i) => i.id);
      const s = withHoldings(fixture(0), [...ids, bonds], [20000, 20000, 20000, 50000]);
      const safe = s.portfolio.at(-1)!;
      const rec = adviceFor(s).find((r) => r.reason === reason)!;
      const r = actOnAdvice(s, rec.id);
      if (!r.ok) throw Error(r.error);
      expect(r.value.state.portfolio.find((h) => h.instrumentId === bonds)).toEqual(safe);
      const after = ids.reduce(
        (sum, id) =>
          sum +
          ((r.value.state.portfolio.find((h) => h.instrumentId === id)?.units ?? 0) *
            priceOf(s.prices, id)) /
            100,
        0,
      );
      expect(after).toBeLessThan(60000);
      expect(60000 - after).toBeCloseTo(rec.amount!, 0);
      expect(reconcile(r.value.state.finance).ok).toBe(true);
      expect(s.portfolio.at(-1)).toEqual(safe);
    },
  );
  it('a named trend reduction sells that name rather than a larger safe position', () => {
    const id = INSTRUMENTS.find((i) => i.kind === 'stock')!.id;
    const original = withHoldings(fixture(), [id, bonds], [10000, 50000]);
    const history = original.prices.history[id]!;
    const s = {
      ...original,
      prices: {
        history: {
          ...original.prices.history,
          [id]: [...history, history.at(-1)!, history.at(-1)! * 2],
        },
      },
    };
    const rec = adviceFor(s).find((r) => r.reason === 'aboveTrend' && r.instrumentId === id)!;
    expect(rec).toBeDefined();
    const r = actOnAdvice(s, rec.id);
    if (!r.ok) throw Error(r.error);
    expect(r.value.state.portfolio.find((h) => h.instrumentId === bonds)).toEqual(
      original.portfolio[1],
    );
    expect(r.value.state.portfolio.find((h) => h.instrumentId === id)!.units).toBeLessThan(
      original.portfolio[0]!.units,
    );
  });
  it('spans several speculative holdings and caps reinvestment at 15% of spare cash', () => {
    const ids = INSTRUMENTS.filter((i) => i.kind === 'crypto')
      .slice(0, 3)
      .map((i) => i.id);
    const s = withHoldings(fixture(), ids, [20000, 20000, 20000]);
    const rec = adviceFor(s).find((r) => r.reason === 'noFloor')!;
    const r = actOnAdvice(s, rec.id);
    if (!r.ok) throw Error(r.error);
    const sold = r.value.state.finance.transactions.filter((t) => t.source.endsWith('— sold'));
    expect(sold.length).toBeGreaterThan(1);
    const raised = sold.reduce((sum, t) => sum + Number(t.amount) / 100, 0);
    const index = r.value.state.portfolio.find((h) => h.instrumentId === 'fd.broadindex')!;
    expect(Number(index.paid) / 100).toBeLessThanOrEqual((advisorCashFor(s).spare + raised) * 0.15);
    expect(Number(index.paid) / 100).toBeLessThan(raised);
    expect(advicePreviewFor(s, rec.id)).toBe(r.value.body);
    expect(r.value.body).toContain('Broad Market Index');
    expect(r.value.body).toContain('stayed in cash');
  });
  it('rechecks stale advice after a goal is set', () => {
    const s = fixture();
    const rec = adviceFor(s).find((r) => r.reason === 'idleCash')!;
    const changed = setCashGoal(s, 100000);
    if (!changed.ok) throw Error(changed.error);
    expect(actOnAdvice(changed.value, rec.id).ok).toBe(false);
  });
  it('keeps idle cash and every forecast quiet while the goal needs the available cash', () => {
    const s = { ...fixture(), cashGoal: 100000 };
    expect(adviceFor(s).filter((r) => r.verb === 'buy')).toEqual([]);
  });
  it('keeps bill and goal cash even through repeated taps', () => {
    let s = fixture();
    const chosen = setCashGoal(s, 40000);
    if (!chosen.ok) throw Error(chosen.error);
    s = chosen.value;
    for (let i = 0; i < 15; i++) {
      const rec = adviceFor(s).find((r) => r.verb === 'buy');
      if (!rec) break;
      const r = actOnAdvice(s, rec.id);
      if (!r.ok) break;
      s = r.value.state;
      expect(Number(s.player.cash) / 100).toBeGreaterThanOrEqual(advisorCashFor(s).reserve);
    }
    expect(reconcile(s.finance).ok).toBe(true);
  });
  it('uses current lifestyle costs and no purchase or operating-account balance', () => {
    const s = {
      ...fixture(),
      household: { ...fixture().household, standard: 90000, housing: 'ownPlace' as const },
    };
    expect(advisorCashFor(s).annualBills).toBe(livingEstimateFor(s, s.household.lifestyle));
    expect(advisorCashFor(s).billReserve).toBe(
      Math.max(12000, livingEstimateFor(s, s.household.lifestyle) * 0.5),
    );
    const lavish = { ...s, household: { ...s.household, lifestyle: 'lavish' as const } };
    expect(advisorCashFor(lavish).reserve).toBeGreaterThan(advisorCashFor(s).reserve);
  });
  it('includes actual scheduled card and personal loan payments, excluding business loans', () => {
    const b = fixture();
    const loan = {
      productId: 'loan.personal',
      balance: dollars(10000),
      principal: dollars(10000),
      termLeft: 5,
      inArrears: false,
    };
    const card = {
      productId: 'card.secured',
      balance: dollars(2000),
      limit: dollars(5000),
      status: 'open' as const,
    };
    const s = {
      ...b,
      loans: [loan, { ...loan, businessId: 'operating-business' }],
      cards: [card],
      businesses: [{ id: 'operating-business' }] as unknown as GameState['businesses'],
    };
    const payments =
      -runLoanYear([loan], Number.MAX_SAFE_INTEGER, false).charges.reduce(
        (n, c) => n + Number(c.amount) / 100,
        0,
      ) -
      runCardYear([card], Number.MAX_SAFE_INTEGER).charges.reduce(
        (n, c) => n + Number(c.amount) / 100,
        0,
      );
    expect(payments).toBeGreaterThan(0);
    expect(advisorCashFor(s).annualBills).toBe(
      livingEstimateFor(s, s.household.lifestyle) + payments,
    );
  });
  it('counts a signed loan after its business closes', () => {
    const b = fixture();
    const loan = {
      productId: 'loan.personal',
      balance: dollars(10000),
      principal: dollars(10000),
      termLeft: 5,
      inArrears: false,
      businessId: 'closed-business',
    };
    const s = { ...b, loans: [loan] };
    const payment = -runLoanYear([loan], Number.MAX_SAFE_INTEGER, false).charges.reduce(
      (n, c) => n + Number(c.amount) / 100,
      0,
    );
    expect(advisorCashFor(s).annualBills).toBe(
      livingEstimateFor(s, s.household.lifestyle) + payment,
    );
  });
  it('adds owner and car bills once, after their existing living allowance', () => {
    const b = fixture();
    const home: OwnedHome = {
      id: 'home:2000:0',
      kindId: 'home.house',
      beds: 3,
      baths: 2,
      builtYear: 1990,
      condition: 'good',
      regionKey: 'oh',
      regionName: 'Ohio',
      purchasePrice: dollars(200000),
      value: dollars(200000),
      boughtYear: 2000,
      expenseRate: 0.02,
      behindYears: 0,
      mortgage: {
        productId: 'mortgage.conventional',
        balance: dollars(150000),
        principal: dollars(150000),
        termLeft: 20,
      },
    };
    const car: OwnedVehicle = {
      id: 'car:2000:0:0',
      trimId: VEHICLE_MODELS[0]!.trims[0]!.id,
      modelYear: 2000,
      boughtYear: 2000,
      purchasePrice: dollars(20000),
      value: dollars(20000),
      condition: 90,
      history: 'full',
      accident: false,
      behindYears: 0,
      loan: {
        productId: 'auto.new',
        balance: dollars(10000),
        principal: dollars(10000),
        termLeft: 4,
      },
    };
    const s = {
      ...b,
      homes: [home],
      vehicles: [car],
      household: { ...b.household, standard: 90000 },
    };
    const separate =
      annualExpenseOf(home) +
      mortgageLineOf(home)!.payment +
      upkeepOf(car, s.world.year) +
      vehicleLoanPayments([car]);
    expect(advisorCashFor(s).annualBills).toBe(
      livingEstimateFor(s, s.household.lifestyle) + separate,
    );
    expect(separate).toBeGreaterThan(5000);
  });
  it('keeps reducing actions player initiated and refuses while a question waits', () => {
    const s = fixture();
    const id = adviceFor(s).find((r) => r.verb === 'buy')!.id;
    const p = { ...s, pending: [{ eventId: 'test' }] as unknown as GameState['pending'] };
    expect(actOnAdvice(p, id).ok).toBe(false);
    expect(s.portfolio).toEqual([]);
    expect(actOnAdvice({ ...s, player: { ...s.player, alive: false } }, id).ok).toBe(false);
  });
  it.each([NaN, Infinity, -1, 1.5])(
    'rejects invalid goal %s without changing RNG or cash',
    (amount) => {
      const s = fixture();
      const before = JSON.stringify(s);
      expect(setCashGoal(s, amount)).toEqual({ ok: false, error: 'invalid-amount' });
      expect(JSON.stringify(s)).toBe(before);
    },
  );
  it('sets and clears the goal without consuming RNG or posting money', () => {
    const s = fixture();
    const r = setCashGoal(s, 65000);
    if (!r.ok) throw Error(r.error);
    expect(r.value.cashGoal).toBe(65000);
    expect(r.value.rng).toEqual(s.rng);
    expect(r.value.finance).toBe(s.finance);
    const cleared = setCashGoal(r.value, 0);
    if (!cleared.ok) throw Error(cleared.error);
    expect(cleared.value).toEqual(s);
  });
  it.each(['child', 'dead', 'pending'])('gates goal commands for %s', (kind) => {
    const b = fixture();
    const s =
      kind === 'child'
        ? { ...b, player: { ...b.player, age: 17 } }
        : kind === 'dead'
          ? { ...b, player: { ...b.player, alive: false } }
          : { ...b, pending: [{ eventId: 'test' }] as unknown as GameState['pending'] };
    expect(setCashGoal(s, 1000).ok).toBe(false);
  });
});
