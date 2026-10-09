import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { findVehicleTrim, VEHICLE_MODS, VEHICLE_MODELS } from '@yearafter/content';
import {
  preventiveServiceCost,
  vehicleYear,
  maintenanceFor,
  strainOf,
  wearFor,
  type OwnedVehicle,
} from './vehicles';
const facts = (id = 'car.royata-camden.se') => {
  const f = findVehicleTrim(id);
  if (!f) throw Error(id);
  return f;
};
const car = (over: Partial<OwnedVehicle> = {}): OwnedVehicle => ({
  id: 'p11-car',
  trimId: 'car.royata-camden.se',
  modelYear: 2030,
  boughtYear: 2030,
  purchasePrice: dollars(31500),
  value: dollars(29000),
  condition: 100,
  history: 'full',
  accident: false,
  behindYears: 0,
  ...over,
});
const rolls = { wear: 0.5, upkeep: 0.5, repair: 0.99, repairSize: 0.5, accident: 0.99 };
describe('P11 literal preventive servicing contract', () => {
  it('extends condition life without bypassing scrapping or an active loan', () => {
    const tired = car({ condition: 9 });
    expect(vehicleYear(tired, facts(), 2031, rolls).finished).toBe(true);
    expect(
      vehicleYear({ ...tired, service: { year: 2030, cost: 230 } }, facts(), 2031, rolls).finished,
    ).toBe(false);
    const loan = {
      productId: 'auto.standard',
      principal: dollars(20000),
      balance: dollars(15000),
      termLeft: 3,
    };
    expect(vehicleYear({ ...tired, loan }, facts(), 2031, rolls).finished).toBe(false);
  });

  it('quotes upcoming age, half mean maintenance and nearest ten', () => {
    expect(preventiveServiceCost(car(), facts(), 2030)).toBe(230);
    expect(preventiveServiceCost(car({ modelYear: 2022 }), facts(), 2030)).toBe(430);
    expect(preventiveServiceCost(car({ modelYear: 2020, condition: 60 }), facts(), 2030)).toBe(470);
  });
  it('excludes loan payments and uses a $100 minimum', () => {
    const loan = {
      productId: 'auto.standard',
      principal: dollars(20000),
      balance: dollars(15000),
      termLeft: 3,
    };
    expect(preventiveServiceCost(car({ loan }), facts(), 2030)).toBe(230);
    const f = facts();
    expect(
      preventiveServiceCost(
        car(),
        { model: { ...f.model, reliability: 0.01 }, trim: f.trim },
        2030,
      ),
    ).toBe(100);
  });
  it('prices actual fitted strain and tired condition', () => {
    const mod = VEHICLE_MODS.find((m) => m.strain > 1);
    if (!mod) throw Error('strain mod');
    const v = car({ condition: 30, mods: [{ modId: mod.id, cost: 2000, year: 2030 }] });
    const expected = Math.max(
      100,
      Math.round((maintenanceFor(facts().model, facts().trim, 1, 30) * mod.strain * 0.5) / 10) * 10,
    );
    expect(preventiveServiceCost(v, facts(), 2030)).toBe(expected);
    expect(preventiveServiceCost(v, facts(), 2030)).toBeGreaterThan(230);
  });
  it('gives exactly 37% less ordinary wear for the first advance', () => {
    const r = vehicleYear(car({ service: { year: 2030, cost: 230 } }), facts(), 2031, rolls);
    expect(r.vehicle.condition).toBe(99.2);
    expect(r.maintenance).toBe(460);
    expect(r.vehicle.history).toBe('full');
    expect(r.vehicle.accident).toBe(false);
  });
  it.each(['full', 'patchy', 'none'] as const)(
    'keeps %s history while reducing its actual wear',
    (history) => {
      const v = car({ history, condition: 70, service: { year: 2030, cost: 230 } });
      const expected = Math.round((70 - wearFor(facts().model, 1, history, 0.5) * 0.63) * 10) / 10;
      expect(vehicleYear(v, facts(), 2031, rolls).vehicle.condition).toBe(expected);
      expect(vehicleYear(v, facts(), 2031, rolls).vehicle.history).toBe(history);
    },
  );
  it('uses measured classic-specific wear instead of granting nineteen extra years', () => {
    const f = facts('car.ferrano-testa-rosa-86.coupe');
    const v = car({
      trimId: f.trim.id,
      modelYear: 1986,
      history: 'patchy',
      condition: 63,
      service: { year: 2030, cost: 2690 },
    });
    const r = vehicleYear(v, f, 2031, rolls);
    expect(r.vehicle.condition).toBe(
      Math.round((63 - wearFor(f.model, 45, 'patchy', 0.5) * 0.75) * 10) / 10,
    );
  });
  it.each([undefined, 2029, 2031, 2032])('ignores a marker for year %s', (year) => {
    const v = car({ ...(year === undefined ? {} : { service: { year, cost: 230 } }) });
    expect(vehicleYear(v, facts(), 2031, rolls).vehicle.condition).toBe(98.8);
  });
  it('expires after one advance even though last paid year remains', () => {
    const one = vehicleYear(
      car({ service: { year: 2030, cost: 230 } }),
      facts(),
      2031,
      rolls,
    ).vehicle;
    expect(one.service).toEqual({ year: 2030, cost: 230 });
    const two = vehicleYear(one, facts(), 2032, rolls);
    expect(two.vehicle.condition).toBe(
      Math.round((one.condition - wearFor(facts().model, 2, 'full', 0.5)) * 10) / 10,
    );
  });
  it('reduces chance by 20 percent rather than twenty points', () => {
    const v = car({ service: { year: 2030, cost: 230 } });
    expect(vehicleYear(car(), facts(), 2031, { ...rolls, repair: 0.05 }).event).toBe('repair');
    expect(vehicleYear(v, facts(), 2031, { ...rolls, repair: 0.05 }).event).toBeUndefined();
    expect(vehicleYear(v, facts(), 2031, { ...rolls, repair: 0.04759 }).event).toBe('repair');
    expect(vehicleYear(v, facts(), 2031, { ...rolls, repair: 0.04761 }).event).toBeUndefined();
  });
  it('leaves hidden faults, crash wear/deductible, existing accident and bills intact', () => {
    const serviced = car({ accident: true, service: { year: 2030, cost: 230 } });
    const crash = vehicleYear(serviced, facts(), 2031, { ...rolls, accident: 0 });
    expect(crash.event).toBe('accident');
    expect(crash.repairCost).toBe(1000);
    expect(crash.vehicle.condition).toBe(84.2);
    expect(crash.vehicle.accident).toBe(true);
    const fault = vehicleYear(
      { ...serviced, defect: { part: 'engine', cost: 4200 } },
      facts(),
      2031,
      { ...rolls, accident: 0, repair: 0 },
    );
    expect(fault.event).toBe('defect');
    expect(fault.repairCost).toBe(4200);
    expect(fault.maintenance).toBe(4660);
    expect(fault.vehicle.condition).toBe(99.2);
    expect(fault.vehicle.defect).toBeUndefined();
  });
  it('leaves the ordinary upkeep, loan and mod readers unchanged', () => {
    const mod = VEHICLE_MODS.find((m) => m.strain > 1);
    if (!mod) throw Error('strain');
    const v = car({
      mods: [{ modId: mod.id, cost: 2000, year: 2030 }],
      loan: {
        productId: 'auto.standard',
        principal: dollars(20000),
        balance: dollars(15000),
        termLeft: 3,
      },
    });
    const a = vehicleYear(v, facts(), 2031, rolls);
    const b = vehicleYear({ ...v, service: { year: 2030, cost: 300 } }, facts(), 2031, rolls);
    expect(b.maintenance).toBe(a.maintenance);
    expect(b.payment).toBe(a.payment);
    expect(b.vehicle.loan).toEqual(a.vehicle.loan);
    expect(strainOf(b.vehicle)).toBe(strainOf(v));
  });
  it('quotes every real catalog trim without repricing it', () => {
    for (const model of VEHICLE_MODELS)
      for (const trim of model.trims) {
        const amount = preventiveServiceCost(car({ trimId: trim.id }), { model, trim }, 2030);
        expect(amount).toBeGreaterThanOrEqual(100);
        expect(amount % 10).toBe(0);
        expect(amount).toBe(
          Math.max(100, Math.round((maintenanceFor(model, trim, 1, 100) * 0.5) / 10) * 10),
        );
      }
  });
});
