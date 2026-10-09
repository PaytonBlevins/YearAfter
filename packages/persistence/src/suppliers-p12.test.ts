import { describe, it, expect } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import {
  post,
  type OwnedBusiness,
  type SupplierAgreement,
  type SupplierSearch,
  type SupplierPitch,
} from '@yearafter/finance';
import {
  createNewGame,
  openBusiness,
  searchSupplier,
  acceptSupplier,
  advanceYear,
} from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const options = { id: asSaveId('p12-save'), createdAt: 0, updatedAt: 0 };
function fixture() {
  const s = createNewGame({ seed: 'p12-save', startYear: 2000 });
  const funding = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(10000000),
    source: 'Savings',
  });
  const adult = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: funding.ledger,
    player: { ...s.player, age: 30, cash: funding.ledger.balance },
  };
  const opened = openBusiness(adult, 'biz.cafe');
  if (!opened.ok) throw Error(opened.error);
  const initial = {
    ...opened.value.state,
    businesses: opened.value.state.businesses.map((b) => ({ ...b, id: 'biz:save' })),
  };
  const searched = searchSupplier(initial, 'biz:save');
  if (!searched.ok) throw Error(searched.error);
  const accepted = acceptSupplier(
    searched.value,
    'biz:save',
    searched.value.businesses[0]!.supplierSearch!.pending!.id,
  );
  if (!accepted.ok) throw Error(accepted.error);
  const next = searchSupplier(accepted.value, 'biz:save');
  if (!next.ok) throw Error(next.error);
  return toSave(next.value, options);
}
describe('P12 save v49', () => {
  it('migrates v48 without inventing a pitch, loyalty, spending or RNG draws', () => {
    const s = fixture();
    const { supplierAgreement: _a, supplierSearch: _s, ...bare } = s.businesses[0]!;
    const old = { ...s, version: 48, businesses: [bare] };
    const before = JSON.stringify(old);
    const r = migrateSave(old);
    if (!r.ok) throw Error(r.error.kind);
    expect(CURRENT_SAVE_VERSION).toBe(50);
    expect(r.value).toEqual({ ...old, version: 50 });
    expect(JSON.stringify(old)).toBe(before);
  });
  it('round trips terms, pending offer and usage and replays real commands/annual settlement', () => {
    const save = fixture();
    const r = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!r.ok) throw Error(r.error.kind);
    expect(r.value).toEqual(save);
    expect(toSave(advanceYear(fromSave(r.value)).state, options)).toEqual(
      toSave(advanceYear(fromSave(save)).state, options),
    );
    const again = searchSupplier(fromSave(r.value), 'biz:save');
    if (!again.ok) throw Error(again.error);
    expect(again.value.businesses[0]!.supplierSearch!.used).toBe(3);
  });
  it('loads stale search history without making last year’s pitch available and loads retired legacy types', () => {
    const save = fixture();
    const old = { ...save, world: { ...save.world, year: 2031 } };
    const r = migrateSave(old);
    expect(r.ok).toBe(true);
    const b = save.businesses[0]!;
    const { supplierAgreement: _a, supplierSearch: _s, ...legacy } = b;
    expect(migrateSave({ ...save, businesses: [{ ...legacy, typeId: 'retired' }] }).ok).toBe(true);
  });
  type WithTerms = OwnedBusiness & {
    supplierAgreement: SupplierAgreement;
    supplierSearch: SupplierSearch & { pending: SupplierPitch };
  };
  const corruptions: [string, (b: WithTerms) => unknown][] = [
    ['negative count', (b) => ({ ...b, supplierSearch: { ...b.supplierSearch, used: -1 } })],
    ['six searches', (b) => ({ ...b, supplierSearch: { ...b.supplierSearch, used: 6 } })],
    ['fraction count', (b) => ({ ...b, supplierSearch: { ...b.supplierSearch, used: 1.5 } })],
    ['zero with pending', (b) => ({ ...b, supplierSearch: { ...b.supplierSearch, used: 0 } })],
    ['future search', (b) => ({ ...b, supplierSearch: { ...b.supplierSearch, year: 2031 } })],
    [
      'stale pending year',
      (b) => ({
        ...b,
        supplierSearch: {
          ...b.supplierSearch,
          pending: { ...b.supplierSearch.pending, year: 2029 },
        },
      }),
    ],
    [
      'wrong pitch ID',
      (b) => ({
        ...b,
        supplierSearch: {
          ...b.supplierSearch,
          pending: { ...b.supplierSearch.pending, id: 'other' },
        },
      }),
    ],
    [
      'accepted pending twice',
      (b) => ({
        ...b,
        supplierSearch: { ...b.supplierSearch, pending: b.supplierAgreement, used: 1 },
      }),
    ],
    ['bad cost', (b) => ({ ...b, supplierAgreement: { ...b.supplierAgreement, cost: 2 } })],
    ['bad quality', (b) => ({ ...b, supplierAgreement: { ...b.supplierAgreement, quality: 0.5 } })],
    [
      'unrounded quote',
      (b) => ({
        ...b,
        supplierAgreement: { ...b.supplierAgreement, cost: b.supplierAgreement.cost + 0.001 },
      }),
    ],
    [
      'bad loyalty',
      (b) => ({ ...b, supplierAgreement: { ...b.supplierAgreement, loyalty: 'perfect' } }),
    ],
    ['bad grade', (b) => ({ ...b, supplier: 'unknown' })],
    [
      'grade mismatch',
      (b) => ({ ...b, supplier: b.supplier === 'premium' ? 'budget' : 'premium' }),
    ],
    [
      'future acceptance',
      (b) => ({ ...b, supplierAgreement: { ...b.supplierAgreement, acceptedYear: 2031 } }),
    ],
    ['empty name', (b) => ({ ...b, supplierAgreement: { ...b.supplierAgreement, name: '' } })],
    ['missing search', (b) => ({ ...b, supplierSearch: undefined })],
    ['null record', (b) => ({ ...b, supplierSearch: null })],
    ['array record', (b) => ({ ...b, supplierAgreement: [] })],
  ];
  it.each(corruptions)('rejects %s', (_name, change) => {
    const save = fixture();
    const malformed = { ...save, businesses: [change(save.businesses[0] as WithTerms)] };
    expect(migrateSave(malformed).ok).toBe(false);
  });
});
