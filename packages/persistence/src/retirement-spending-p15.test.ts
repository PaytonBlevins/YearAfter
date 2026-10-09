import { describe, expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { post, reconcile } from '@yearafter/finance';
import { createNewGame, advanceYear } from '@yearafter/simulation';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { migrateSave } from './migrations';
import { toSave, fromSave } from './serialize';
const options = { id: asSaveId('p15-save'), createdAt: 0, updatedAt: 0 };
function fixture(tier: 'frugal' | 'comfortable' | 'lavish') {
  const s = createNewGame({ seed: 'p15-save', startYear: 2000 });
  const finance = post(s.finance, 2074, 74, {
    category: 'gift',
    amount: dollars(512000),
    source: 'Savings',
  }).ledger;
  return toSave(
    {
      ...s,
      pending: [],
      world: { ...s.world, year: 2074 },
      player: { ...s.player, age: 74, cash: finance.balance },
      finance,
      retirement: { ...s.retirement, retiredAtAge: 65, balance: dollars(220000) },
      household: { ...s.household, lifestyle: tier, standard: 30000, housing: 'ownPlace' },
    },
    options,
  );
}
describe('P15 derived policy without a save bump', () => {
  it.each(['frugal', 'comfortable', 'lavish'] as const)(
    'round-trips %s and advances actual retirement deterministically',
    (tier) => {
      const save = fixture(tier);
      expect(CURRENT_SAVE_VERSION).toBe(51);
      const migrated = migrateSave(JSON.parse(JSON.stringify(save)));
      if (!migrated.ok) throw Error(migrated.error.kind);
      expect(migrated.value).toEqual(save);
      const next = advanceYear(fromSave(save)).state;
      const reloaded = advanceYear(fromSave(migrated.value)).state;
      expect(toSave(next, options)).toEqual(toSave(reloaded, options));
      expect(next.household.lifestyle).toBe(tier);
      expect(reconcile(next.finance).ok).toBe(true);
    },
  );
  it('migrates v49 without changing pension, cash, remembered standard, history or RNG', () => {
    const save = fixture('comfortable');
    const migrated = migrateSave({ ...save, version: 49 });
    if (!migrated.ok) throw Error(migrated.error.kind);
    expect(migrated.value.retirement).toEqual(save.retirement);
    expect(migrated.value.finance).toEqual(save.finance);
    expect(migrated.value.household).toEqual(save.household);
    expect(migrated.value.rng).toEqual(save.rng);
  });
});
