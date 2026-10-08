import { describe, expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { readFileSync } from 'node:fs';
const VALUABLES = JSON.parse(
  readFileSync(new URL('../../content/data/valuables.json', import.meta.url), 'utf8'),
).entries as readonly { id: string; kind: string; price: number }[];
import { createNewGame, advanceYear, collectionOf } from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';

const options = { id: asSaveId('p8-collection'), createdAt: 0, updatedAt: 0 };
function collectionSave() {
  const base = createNewGame({ seed: 'p8-save' });
  const initial = toSave(
    {
      ...base,
      pending: [],
      player: { ...base.player, age: 30 },
      valuables: VALUABLES.filter((v) => v.kind === 'watch').map((v, i) => ({
        id: `val:2000:store.maison:${i}`,
        itemId: v.id,
        boughtYear: 2000,
        purchasePrice: dollars(v.price),
        value: dollars(Math.round(v.price * 0.75)),
        inheritedFrom: 'P8 fixture parent',
      })),
    },
    options,
  );
  // The existing RNG loader normalizes signed words to unsigned equivalents.
  // Start with that canonical fixture so this checks catalog round-trip changes.
  return toSave(fromSave(initial), options);
}

describe('P8 — old and new catalog IDs in unchanged save v46', () => {
  it('round trips all 55 watches including existing holdings and the $20m model', () => {
    const save = collectionSave();
    expect(CURRENT_SAVE_VERSION).toBe(46);
    expect(save.valuables).toHaveLength(55);
    const result = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!result.ok) throw Error(result.error.kind);
    const state = fromSave(result.value);
    expect(state.valuables).toEqual(save.valuables);
    expect(toSave(state, options)).toEqual(save);
    const shelf = collectionOf(state).find((s) => s.shelf === 'watches');
    expect(shelf?.pieces).toHaveLength(55);
    expect(shelf?.pieces[0]?.item.id).toBe('val.watch.jakob-timeless-treasure');
    expect(shelf?.pieces.every((p) => p.item.id === p.owned.itemId)).toBe(true);
    expect(state.rng.snapshot()).toEqual(save.rng);
  });
  it('preserves a pre-P8 collection through the existing v45 migration', () => {
    const current = collectionSave();
    const oldIds = new Set(VALUABLES.slice(0, 151).map((v) => v.id));
    const { cashGoal: _goal, ...rest } = current;
    const legacy = {
      ...rest,
      version: 45,
      valuables: current.valuables.filter((v) => oldIds.has(v.itemId)),
    };
    expect(legacy.valuables).toHaveLength(37);
    const result = migrateSave(legacy);
    if (!result.ok) throw Error(result.error.kind);
    expect(result.value.valuables).toEqual(legacy.valuables);
    expect(
      collectionOf(fromSave(result.value)).find((s) => s.shelf === 'watches')?.pieces,
    ).toHaveLength(37);
    expect(result.value.rng).toEqual(legacy.rng);
  });
  it('settles a real year identically after load, preserving models and provenance', () => {
    const save = collectionSave();
    const a = advanceYear(fromSave(save)).state;
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!migrated.ok) throw Error(migrated.error.kind);
    const b = advanceYear(fromSave(migrated.value)).state;
    expect(a.world.year).toBe(save.world.year + 1);
    expect(toSave(a, options)).toEqual(toSave(b, options));
    expect(a.valuables.map((v) => v.itemId)).toEqual(save.valuables.map((v) => v.itemId));
    expect(a.valuables.every((v) => v.inheritedFrom === 'P8 fixture parent')).toBe(true);
    for (const before of save.valuables) {
      expect(a.valuables.find((v) => v.itemId === before.itemId)?.value, before.itemId).not.toBe(
        before.value,
      );
    }
  });
});
