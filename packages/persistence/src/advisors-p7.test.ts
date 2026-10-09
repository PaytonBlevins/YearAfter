import { describe, it, expect } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame, advanceYear } from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const saved = () =>
  toSave(
    { ...createNewGame({ seed: 'p7-save' }), cashGoal: 65000, advisorId: 'adv.independent' },
    { id: asSaveId('p7-save'), createdAt: 0, updatedAt: 0 },
  );
describe('P7 save v46', () => {
  it('uses current version 49', () => expect(CURRENT_SAVE_VERSION).toBe(49));
  it('migrates v45 with no invented goal, preserving all other data', () => {
    const legacy = { ...saved(), version: 45 };
    const before = JSON.stringify(legacy);
    const r = migrateSave(legacy);
    if (!r.ok) throw Error(r.error.kind);
    const { cashGoal: _old, ...rest } = legacy;
    expect(r.value).toEqual({ ...rest, version: 49 });
    expect(JSON.stringify(legacy)).toBe(before);
    expect(migrateSave(legacy)).toEqual(r);
  });
  it('round trips the goal and replays identically', () => {
    const save = saved();
    const loaded = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!loaded.ok) throw Error(loaded.error.kind);
    expect(loaded.value.cashGoal).toBe(65000);
    expect(fromSave(loaded.value).cashGoal).toBe(65000);
    expect(fromSave(loaded.value).advisorId).toBe('adv.independent');
    const opts = { id: save.id, createdAt: 0, updatedAt: 0 };
    expect(toSave(advanceYear(fromSave(save)).state, opts)).toEqual(
      toSave(advanceYear(fromSave(loaded.value)).state, opts),
    );
  });
  it.each([null, '65000', {}, [], NaN, Infinity, -1, 1.5])(
    'rejects malformed goal %j',
    (cashGoal) => expect(migrateSave({ ...saved(), cashGoal }).ok).toBe(false),
  );
  it('accepts absent goal and zero', () => {
    const { cashGoal: _old, ...s } = saved();
    expect(migrateSave(s).ok).toBe(true);
    expect(migrateSave({ ...s, cashGoal: 0 }).ok).toBe(true);
  });
});
