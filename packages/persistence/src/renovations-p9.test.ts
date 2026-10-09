import { describe, expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { createNewGame, advanceYear, renovationComfortFor } from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const options = { id: asSaveId('p9-home'), createdAt: 0, updatedAt: 0 };
function fixture() {
  const s = createNewGame({ seed: 'p9-save' });
  const raw = toSave(
    {
      ...s,
      pending: [],
      player: { ...s.player, age: 30 },
      homes: [
        {
          id: 'home:2000:0',
          kindId: 'home.condo',
          beds: 4,
          baths: 2,
          builtYear: 1980,
          condition: 'good',
          regionKey: 'US:OH',
          regionName: 'Ohio',
          purchasePrice: dollars(500000),
          boughtYear: 2000,
          value: dollars(650000),
          expenseRate: 0.02,
          behindYears: 0,
          renovations: [
            { renovationId: 'reno.pool', cost: 87654, year: 1990 },
            { renovationId: 'reno.study', cost: 16500, year: 2000 },
          ],
        },
      ],
    },
    options,
  );
  return toSave(fromSave(raw), options);
}
describe('P9 saved work', () => {
  it('round trips an over-capacity legacy home without deleting work or changing its paid amounts', () => {
    const save = fixture();
    expect(CURRENT_SAVE_VERSION).toBe(51);
    const loaded = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!loaded.ok) throw Error(loaded.error.kind);
    const state = fromSave(loaded.value);
    expect(toSave(state, options)).toEqual(save);
    expect(state.homes).toEqual(save.homes);
    expect(state.homes[0]!.beds).toBe(4);
    expect(state.homes[0]!.value).toBe(dollars(650000));
    expect(renovationComfortFor(state.homes, false, 0)).toBe(3);
    const old = { ...save, version: 45 };
    const migrated = migrateSave(old);
    if (!migrated.ok) throw Error(migrated.error.kind);
    expect(migrated.value.homes).toEqual(save.homes);
    expect(migrated.value.rng).toEqual(save.rng);
  });
  it('replays the annual settlement identically after reload', () => {
    const save = fixture();
    const a = advanceYear(fromSave(save)).state;
    const migration = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!migration.ok) throw Error(migration.error.kind);
    const b = advanceYear(fromSave(migration.value)).state;
    expect(toSave(a, options)).toEqual(toSave(b, options));
    expect(a.homes[0]?.renovations).toEqual(save.homes[0]?.renovations);
  });
});
