import { describe, it, expect } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { post } from '@yearafter/finance';
import {
  createNewGame,
  openBusiness,
  setBusinessAgentLevel,
  searchSupplier,
  acceptSupplier,
  advanceYear,
  type GameState,
} from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const options = { id: asSaveId('p13-save'), createdAt: 0, updatedAt: 0 };
function value<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw Error(String(r.error));
  return r.value;
}
function fixture(level = true) {
  const s = createNewGame({ seed: 'p13-save', startYear: 2000 });
  const funding = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(10000000),
    source: 'Savings',
  });
  let state: GameState = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: funding.ledger,
    player: { ...s.player, age: 30, cash: funding.ledger.balance },
  };
  state = value(openBusiness(state, 'biz.realestate')).state;
  state = value(openBusiness(state, 'biz.cafe')).state;
  const broker = state.businesses[0]!;
  const cafe = state.businesses[1]!;
  state = value(searchSupplier(state, cafe.id));
  state = value(acceptSupplier(state, cafe.id, state.businesses[1]!.supplierSearch!.pending!.id));
  state = value(searchSupplier(state, cafe.id));
  if (level) state = value(setBusinessAgentLevel(state, broker.id, 'high'));
  return toSave(state, options);
}
describe('P13 save v50', () => {
  it('migrates v49, normalizing only current brokerage price with no new agent, reward, transaction or RNG draw', () => {
    const save = fixture(false);
    const old = {
      ...save,
      version: 49,
      businesses: save.businesses.map((b, i) => ({ ...b, price: i === 0 ? 140 : 120 })),
    };
    const before = JSON.stringify(old);
    const r = value(migrateSave(old));
    expect(CURRENT_SAVE_VERSION).toBe(50);
    expect(r).toEqual({
      ...old,
      version: 50,
      businesses: old.businesses.map((b, i) => (i === 0 ? { ...b, price: 100 } : b)),
    });
    expect(r.businesses[0]!.agentLevel).toBeUndefined();
    expect(r.businesses[1]!.supplierAgreement).toEqual(old.businesses[1]!.supplierAgreement);
    expect(r.businesses[1]!.supplierSearch).toEqual(old.businesses[1]!.supplierSearch);
    expect(JSON.stringify(old)).toBe(before);
  });
  it('round trips level and P12 contracts and replays real annual settlement identically', () => {
    const save = fixture();
    const r = value(migrateSave(JSON.parse(JSON.stringify(save))));
    expect(r).toEqual(save);
    expect(r.businesses[0]!.agentLevel).toBe('high');
    expect(toSave(advanceYear(fromSave(r)).state, options)).toEqual(
      toSave(advanceYear(fromSave(save)).state, options),
    );
  });
  it.each(['low', 'mid', 'high'] as const)('round trips a valid %s team', (level) => {
    const save = fixture();
    const current = {
      ...save,
      businesses: save.businesses.map((b, i) => (i === 0 ? { ...b, agentLevel: level } : b)),
    };
    expect(value(migrateSave(current))).toEqual(current);
  });
  it.each(['perfect', null, 7, {}, [], true])('rejects malformed level %j', (agentLevel) => {
    const save = fixture();
    expect(
      migrateSave({
        ...save,
        businesses: save.businesses.map((b, i) => (i === 0 ? { ...b, agentLevel } : b)),
      }).ok,
    ).toBe(false);
  });
  it.each(['biz.marketing', 'biz.cafe', 'retired'])(
    'refuses a stored agent level on %s',
    (typeId) => {
      const save = fixture();
      expect(
        migrateSave({
          ...save,
          businesses: save.businesses.map((b, i) => (i === 0 ? { ...b, typeId } : b)),
        }).ok,
      ).toBe(false);
    },
  );
  it('keeps retired legacy types readable without an invented agent level', () => {
    const save = fixture(false);
    const old = {
      ...save,
      version: 49,
      businesses: [{ ...save.businesses[0]!, typeId: 'retired', price: 140 }],
    };
    const r = value(migrateSave(old));
    expect(r.businesses[0]!.typeId).toBe('retired');
    expect(r.businesses[0]!.price).toBe(140);
    expect(r.businesses[0]!.agentLevel).toBeUndefined();
  });
});
