import { describe, it, expect } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { post } from '@yearafter/finance';
import {
  createNewGame,
  rentalListings,
  buyHome,
  fillEmptyUnits,
  advanceYear,
  type GameState,
} from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const options = { id: asSaveId('p14-save'), createdAt: 0, updatedAt: 0 };
function fixture(how: 'cash' | 'mortgage' | 'mortgage-half') {
  const s = createNewGame({ seed: 'p14-save', startYear: 2000 });
  let ledger = post(s.finance, 2030, 30, {
    category: 'salary',
    amount: dollars(1000000),
    source: 'Earnings',
  }).ledger;
  ledger = post(ledger, 2030, 30, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Savings',
  }).ledger;
  const state: GameState = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: ledger,
    player: {
      ...s.player,
      age: 30,
      cash: ledger.balance,
    },
  };
  const r = buyHome(state, rentalListings(state)[0]!.id, how);
  if (!r.ok) throw Error(r.error);
  const f = fillEmptyUnits(r.value.state, r.value.home.id);
  if (!f.ok) throw Error(f.error);
  return toSave(f.value.state, options);
}
describe('P14 compatibility without a new save field', () => {
  it.each(['cash', 'mortgage', 'mortgage-half'] as const)(
    'round-trips %s holdings and replays actual advance exactly',
    (how) => {
      const saved = fixture(how);
      const r = migrateSave(JSON.parse(JSON.stringify(saved)));
      if (!r.ok) throw Error(String(r.error));
      expect(CURRENT_SAVE_VERSION).toBe(51);
      expect(r.value).toEqual(saved);
      expect(toSave(advanceYear(fromSave(r.value)).state, options)).toEqual(
        toSave(advanceYear(fromSave(saved)).state, options),
      );
    },
  );
  it('reads an old v49 holding without rewriting its mortgage or tenant contract', () => {
    const saved = fixture('mortgage');
    const r = migrateSave({ ...saved, version: 49 });
    if (!r.ok) throw Error(String(r.error));
    expect(r.value.homes).toEqual(saved.homes);
    expect(r.value.finance).toEqual(saved.finance);
    expect(r.value.rng).toEqual(saved.rng);
  });
});
