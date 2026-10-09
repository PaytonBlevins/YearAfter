import { describe, it, expect } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { createNewGame, serviceVehicle, advanceYear } from '@yearafter/simulation';
import { post } from '@yearafter/finance';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
const options = { id: asSaveId('p11-save'), createdAt: 0, updatedAt: 0 };
function fixture(serviced = true) {
  const s = createNewGame({ seed: 'p11-save', startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(100000),
    source: 'Savings',
  });
  const state = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: f.ledger,
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    vehicles: [
      {
        id: 'save-car',
        trimId: 'car.royata-camden.se',
        boughtYear: 2030,
        modelYear: 2030,
        purchasePrice: dollars(31500),
        value: dollars(29000),
        condition: 100,
        history: 'none' as const,
        accident: true,
        behindYears: 0,
      },
    ],
  };
  const r = serviceVehicle(state, 'save-car');
  if (!r.ok) throw Error(r.error);
  return toSave(serviced ? r.value.state : state, options);
}
describe('P11 save v48', () => {
  it('migrates v47 without inventing care or changing financial/vehicle/RNG history', () => {
    const old = { ...fixture(false), version: 47 };
    const before = JSON.stringify(old);
    const r = migrateSave(old);
    if (!r.ok) throw Error(r.error.kind);
    expect(CURRENT_SAVE_VERSION).toBe(48);
    expect(r.value).toEqual({ ...old, version: 48 });
    expect(r.value.vehicles[0]?.service).toBeUndefined();
    expect(JSON.stringify(old)).toBe(before);
  });
  it('round trips paid cost/year and replays the actual next advance identically', () => {
    const save = fixture();
    const r = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!r.ok) throw Error(r.error.kind);
    expect(r.value).toEqual(save);
    expect(r.value.vehicles[0]?.service).toEqual({ year: 2030, cost: 230 });
    expect(r.value.vehicles[0]?.history).toBe('none');
    expect(r.value.vehicles[0]?.accident).toBe(true);
    expect(toSave(advanceYear(fromSave(save)).state, options)).toEqual(
      toSave(advanceYear(fromSave(r.value)).state, options),
    );
  });
  it('keeps unsupported legacy cars readable and expired records for display only', () => {
    const save = fixture();
    const legacy = {
      ...save,
      vehicles: save.vehicles.map((v) => ({
        ...v,
        trimId: 'old-retired-car',
        service: { year: 2030, cost: 230 },
      })),
    };
    const r = migrateSave(legacy);
    if (!r.ok) throw Error(r.error.kind);
    expect(r.value.vehicles).toEqual(legacy.vehicles);
    const expired = migrateSave({ ...save, world: { ...save.world, year: 2040 } });
    if (!expired.ok) throw Error(expired.error.kind);
    expect(expired.value.vehicles[0]?.service?.year).toBe(2030);
  });
  it.each([
    null,
    [],
    'yes',
    {},
    { year: 2030, cost: 0 },
    { year: 2030, cost: 99 },
    { year: 2030, cost: 235 },
    { year: 2030, cost: -100 },
    { year: 2030, cost: 230.5 },
    { year: 2030, cost: Infinity },
    { year: 2030, cost: Number.MAX_SAFE_INTEGER + 1 },
    { year: 2030.5, cost: 230 },
    { year: 2029, cost: 230 },
    { year: 2031, cost: 230 },
    { year: '2030', cost: 230 },
    { year: 2030, cost: '230' },
  ])('refuses malformed service %j', (service) => {
    const s = fixture();
    const r = migrateSave({ ...s, vehicles: s.vehicles.map((v) => ({ ...v, service })) });
    expect(r.ok).toBe(false);
    if (r.ok) throw Error('accepted malformed service');
    expect(JSON.stringify(r.error)).toContain('vehicles');
  });
  it.each([null, [], 3])('refuses malformed car %j instead of throwing', (car) => {
    const r = migrateSave({ ...fixture(), vehicles: [car] });
    expect(r.ok).toBe(false);
  });
});
