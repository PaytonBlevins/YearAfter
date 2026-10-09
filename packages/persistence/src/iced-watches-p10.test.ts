import { describe, expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { createNewGame, advanceYear } from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const opts = { id: asSaveId('p10-save'), createdAt: 0, updatedAt: 0 };
function fixture() {
  const s = createNewGame({ seed: 'p10-save' });
  return toSave(
    fromSave(
      toSave(
        {
          ...s,
          pending: [],
          world: { ...s.world, year: 2030 },
          player: { ...s.player, age: 10 },
          valuables: [
            {
              id: 'heir:watch',
              itemId: 'val.watch.rolux-subaquatic',
              boughtYear: 1990,
              purchasePrice: dollars(10400),
              value: dollars(5850),
              icing: { cost: dollars(10000), year: 1995 },
              inheritedFrom: 'Grandparent',
              fake: true,
            },
            {
              id: 'factory',
              itemId: 'val.watch.jakob-timeless-treasure',
              boughtYear: 2000,
              purchasePrice: dollars(20000000),
              value: dollars(13000000),
            },
            {
              id: 'old.unknown',
              itemId: 'unknown.retired-watch',
              boughtYear: 1980,
              purchasePrice: dollars(500),
              value: dollars(350),
            },
          ],
        },
        opts,
      ),
    ),
    opts,
  );
}
describe('P10 save v47 paid watch work', () => {
  it('migrates actual v46 holdings without inventing work, revaluation, charges or RNG', () => {
    const save = fixture();
    const old = {
      ...save,
      version: 46,
      valuables: save.valuables.map(({ icing: _work, ...piece }) => piece),
    };
    const before = JSON.stringify(old);
    const r = migrateSave(old);
    if (!r.ok) throw Error(r.error.kind);
    expect(CURRENT_SAVE_VERSION).toBe(49);
    expect(r.value).toEqual({ ...old, version: 49 });
    expect(r.value.valuables.every((p) => p.icing === undefined)).toBe(true);
    expect(JSON.stringify(old)).toBe(before);
    expect(migrateSave(old)).toEqual(r);
  });
  it('round trips historical work and counterfeit/provenance fields, then replays identically', () => {
    const save = fixture();
    const r = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!r.ok) throw Error(JSON.stringify(r.error));
    expect(r.value.valuables[0]!.icing).toEqual({ cost: dollars(10000), year: 1995 });
    expect(toSave(fromSave(r.value), opts)).toEqual(save);
    expect(toSave(advanceYear(fromSave(save)).state, opts)).toEqual(
      toSave(advanceYear(fromSave(r.value)).state, opts),
    );
    expect(r.value.valuables[2]!.value).toBe(dollars(350));
  });
  it.each(['val.watch.jakob-timeless-treasure', 'val.watch.apple-ish', 'val.ring.signet-gold'])(
    'rejects work attached to known ineligible %s',
    (itemId) => {
      const s = fixture();
      expect(migrateSave({ ...s, valuables: [{ ...s.valuables[0]!, itemId }] }).ok).toBe(false);
    },
  );
  it.each([
    null,
    [],
    {},
    { cost: -1, year: 2020 },
    { cost: 1.5, year: 2020 },
    { cost: '100', year: 2020 },
    { cost: 100, year: 2031 },
    { cost: 100, year: 1989 },
    { cost: 100, year: 2020.5 },
    { cost: 100, year: '2020' },
  ])('rejects malformed work %j', (icing) => {
    const s = fixture();
    expect(migrateSave({ ...s, valuables: [{ ...s.valuables[0]!, icing }] }).ok).toBe(false);
  });
});
