import { describe, expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { BUSINESS_LOAN_PRODUCTS, newBusiness, post } from '@yearafter/finance';
import {
  businessMarket,
  createNewGame,
  runBusinessesYear,
  withBusinessRescue,
  decide,
  advanceYear,
} from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
function saved() {
  const base = createNewGame({ seed: 'saved-rescue', startYear: 2000 });
  const type = businessMarket({
    ...base,
    player: { ...base.player, age: 31, cash: dollars(10_000_000) },
  }).find((row) => row.id === 'biz.restaurant')!;
  if (!type) throw new Error('Restaurant fixture unavailable');
  const business = {
    ...newBusiness(type, 'biz:save', 'Saved Place', 2030, 0.55),
    staff: type.staff * 2,
    cash: dollars(0),
    reputation: 5,
  };
  const loan = {
    productId: BUSINESS_LOAN_PRODUCTS[0]!.id,
    businessId: business.id,
    principal: dollars(3_000_000),
    balance: dollars(3_000_000),
    termLeft: 10,
    inArrears: false,
  };
  const year = runBusinessesYear({
    businesses: [business],
    loans: [loan],
    year: 2031,
    seed: 'insolvent',
    market: 'severeRecession',
    available: 10_000_000,
    holdsJob: false,
    stat: () => 10,
  });
  const finance = post(base.finance, 2031, 31, {
    category: 'gift',
    amount: dollars(10_000_000),
    source: 'Savings',
  }).ledger;
  const state = withBusinessRescue(
    {
      ...base,
      world: { ...base.world, year: 2031 },
      player: { ...base.player, age: 31, cash: finance.balance },
      finance,
      businesses: year.businesses,
      loans: year.loans,
    },
    year.rescues,
  );
  return toSave(state, { id: asSaveId('p1-save'), createdAt: 0, updatedAt: 0 });
}
describe('P1 — saved business rescue', () => {
  it('round trips the real quote, negative till, loan and pause, and resolves identically after load', () => {
    const save = saved();
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    const loaded = migrateSave(JSON.parse(JSON.stringify(save)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.error.kind);
    const restored = fromSave(loaded.value);
    expect(restored.businessRescue).toEqual(save.businessRescue);
    expect(restored.businesses).toEqual(save.businesses);
    expect(restored.loans).toEqual(save.loans);
    expect(advanceYear(restored).newEntries).toEqual([]);
    for (const choice of ['inject:biz:save', 'close:biz:save']) {
      const a = decide(restored, 'business.rescue', choice);
      const b = decide(fromSave(save), 'business.rescue', choice);
      if (!a.ok || !b.ok) throw new Error('Could not answer');
      const options = { id: save.id, createdAt: 0, updatedAt: 0 };
      expect(toSave(a.value.state, options)).toEqual(toSave(b.value.state, options));
      expect(migrateSave(toSave(a.value.state, options)).ok).toBe(true);
    }
  });
  it('migrates v43 purely, preserves every legacy field and does not invent a review or move RNG', () => {
    const current = toSave(createNewGame({ seed: 'v43-legacy' }), { id: asSaveId('legacy') });
    const legacy = { ...current, version: 43 };
    const before = JSON.stringify(legacy);
    const migrated = migrateSave(legacy);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) throw new Error(migrated.error.kind);
    expect(migrated.value).toEqual({ ...legacy, version: CURRENT_SAVE_VERSION });
    expect(migrated.value.businessRescue).toBeUndefined();
    expect(migrated.value.rng).toEqual(legacy.rng);
    expect(JSON.stringify(legacy)).toBe(before);
  });
  it.each([
    { amount: 0 },
    { amount: -1 },
    { amount: 0.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { amount: 'money' },
    { businessId: 'missing' },
    { loanPayment: -1 },
    { loanPayment: 1 },
    { loanBalance: 1 },
    { loanProductId: 'missing' },
    { fundedLoan: undefined },
    { fundedLoan: { balance: 0 } },
  ])('rejects malformed or forged rescue row %j', (patch) => {
    const save = saved();
    const review = save.businessRescue!;
    expect(
      migrateSave({
        ...save,
        businessRescue: { ...review, cases: [{ ...review.cases[0], ...patch }] },
      }).ok,
    ).toBe(false);
  });
  it.each([
    'year',
    'empty',
    'duplicate',
    'missing-pending',
    'orphan-pending',
    'choice',
    'dead',
    'cash',
    'term',
  ])('rejects inconsistent %s', (fault) => {
    const save = saved();
    const row = save.businessRescue!.cases[0]!;
    const patches: Record<string, unknown> = {
      year: { businessRescue: { ...save.businessRescue, year: 2032 } },
      empty: { businessRescue: { ...save.businessRescue, cases: [] } },
      duplicate: { businessRescue: { ...save.businessRescue, cases: [row, row] } },
      'missing-pending': { pending: [] },
      'orphan-pending': { businessRescue: undefined },
      choice: {
        pending: [{ ...save.pending[0], choices: [{ id: 'inject:missing', label: 'Inject' }] }],
      },
      dead: { player: { ...save.player, alive: false } },
      cash: { businesses: [{ ...save.businesses[0], cash: dollars(1_000_000) }] },
      term: {
        businessRescue: {
          ...save.businessRescue,
          cases: [{ ...row, fundedLoan: { ...row.fundedLoan, termLeft: 999 } }],
        },
      },
    };
    expect(migrateSave({ ...save, ...(patches[fault] as object) }).ok).toBe(false);
  });
});
