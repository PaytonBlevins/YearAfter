import { CURRENT_SAVE_VERSION } from './save-schema';
import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { advanceYear, createNewGame, setLifestyle } from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
const options = { id: asSaveId('saved-lifestyle'), createdAt: 0, updatedAt: 0 };
const saved = () => toSave(createNewGame({ seed: 'p2-save' }), options);
describe('P2 — save v45 lifestyle', () => {
  it('migrates v44 by defaulting only the tier, preserving standard, history, money and RNG', () => {
    const current = saved();
    const { lifestyle: _future, ...household } = {
      ...current.household,
      standard: 80_000,
      leftHomeAt: 20,
      movedBackAt: 30,
    };
    const legacy = { ...current, version: 44, household };
    const before = JSON.stringify(legacy);
    const result = migrateSave(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value).toEqual({
      ...legacy,
      version: CURRENT_SAVE_VERSION,
      household: { ...household, lifestyle: 'comfortable' },
    });
    expect(JSON.stringify(legacy)).toBe(before);
    expect(migrateSave(legacy)).toEqual(result);
  });
  it.each(['frugal', 'comfortable', 'lavish'] as const)(
    'round trips %s and settles identically after load',
    (tier) => {
      const base = createNewGame({ seed: `p2-${tier}` });
      const chosen = setLifestyle({ ...base, player: { ...base.player, age: 30 } }, tier);
      if (!chosen.ok) throw new Error(chosen.error);
      const save = toSave(chosen.value, options);
      expect(save.version).toBe(CURRENT_SAVE_VERSION);
      const loaded = migrateSave(JSON.parse(JSON.stringify(save)));
      if (!loaded.ok) throw new Error(loaded.error.kind);
      expect(loaded.value.household.lifestyle).toBe(tier);
      const a = advanceYear(fromSave(save)).state;
      const b = advanceYear(fromSave(loaded.value)).state;
      expect(toSave(a, options)).toEqual(toSave(b, options));
      expect(a.household.lifestyle).toBe(tier);
    },
  );
  it.each([
    undefined,
    null,
    [],
    1,
    'cheap',
    {},
    { lifestyle: 'lavish' },
    { standard: 20_000, housing: 'hotel', lifestyle: 'frugal' },
    { standard: 0, housing: 'ownPlace', lifestyle: 'comfortable' },
    { standard: Infinity, housing: 'ownPlace', lifestyle: 'lavish' },
    { standard: 20_000, housing: 'ownPlace', lifestyle: 'lavish', leftHomeAt: -1 },
    { standard: 20_000, housing: 'ownPlace', lifestyle: 'lavish', movedBackAt: 1.5 },
  ])('rejects malformed current household %j', (household) => {
    expect(migrateSave({ ...saved(), household }).ok).toBe(false);
  });
  it.each([undefined, 'unknown', 4, null])(
    'rejects current tier %j instead of resetting it',
    (lifestyle) => {
      const save = saved();
      expect(migrateSave({ ...save, household: { ...save.household, lifestyle } }).ok).toBe(false);
    },
  );
});
