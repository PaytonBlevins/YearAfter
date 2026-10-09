/**
 * Ticket 0504 — the rules of owning a car.
 *
 * Spec 141: value from age, model, condition, a hidden service history,
 * accident history and rarity, and no mileage. Spec 179–182: the costs are the
 * loan payment and maintenance, with repairs merged in. Spec 1329: financing
 * is instant approve or deny. Spec 1387: normal cars depreciate, a few
 * collector cars appreciate.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  findVehicleMod,
  findVehicleModel,
  findVehicleTrim,
  type VehicleModel,
  type VehicleTrim,
} from '@yearafter/content';
import {
  CAR_PAYMENT_CEILING,
  COLLECTIBLE_TROUGH,
  REPOSSESSED_SALE,
  SCRAPPED_BELOW,
  TRADE_IN,
  carLoanFor,
  gripOf,
  hasTarbus,
  modPriceOf,
  modRefusalFor,
  strainOf,
  vehicleWorthOf,
  withMod,
  conditionLabelOf,
  expectedCondition,
  maintenanceFor,
  monthlyCostOf,
  retainedShare,
  vehicleSaleOf,
  vehicleValueOf,
  vehicleYear,
  vehiclesValue,
  vehicleLoansOwed,
  type CarBuyer,
  type OwnedVehicle,
} from './vehicles';
import { livingCostFor } from './living';

const facts = (trimId: string): { model: VehicleModel; trim: VehicleTrim } => {
  const found = findVehicleTrim(trimId);
  if (!found) throw new Error(trimId);
  return found;
};

const CAMDEN = 'car.royata-camden.se';
const FIVE_LINE = 'car.rbw-5-line.541i';

const owned = (over: Partial<OwnedVehicle> = {}): OwnedVehicle => ({
  id: 'car:2030:lot.new-1:0',
  trimId: CAMDEN,
  modelYear: 2030,
  boughtYear: 2030,
  purchasePrice: dollars(31_500),
  value: dollars(29_000),
  condition: 100,
  history: 'full',
  accident: false,
  behindYears: 0,
  ...over,
});

const ROLLS = { wear: 0.5, upkeep: 0.5, repair: 0.99, repairSize: 0.5, accident: 0.99 };

describe('0504 — what a car is worth', () => {
  it('falls every year for an ordinary car, fastest in the first', () => {
    for (const retention of ['strong', 'average', 'weak', 'exotic'] as const) {
      let previous = 1;
      for (let age = 0; age < 25; age += 1) {
        const share = retainedShare(retention, age);
        expect(share).toBeLessThan(previous);
        previous = share;
      }
      // The first full year takes more than any later one.
      const first = retainedShare(retention, 0) - retainedShare(retention, 1);
      const later = retainedShare(retention, 3) - retainedShare(retention, 4);
      expect(first).toBeGreaterThan(later);
    }
  });

  it('keeps about 60% / half / a third after five years by how the model holds value', () => {
    expect(retainedShare('strong', 5)).toBeGreaterThan(0.55);
    expect(retainedShare('strong', 5)).toBeLessThan(0.66);
    expect(retainedShare('average', 5)).toBeGreaterThan(0.44);
    expect(retainedShare('average', 5)).toBeLessThan(0.53);
    expect(retainedShare('weak', 5)).toBeGreaterThan(0.3);
    expect(retainedShare('weak', 5)).toBeLessThan(0.4);
  });

  it('stops falling and rises for a collectible past the trough (spec 1387)', () => {
    const at = (age: number) => retainedShare('strong', age, true);
    expect(at(COLLECTIBLE_TROUGH + 10)).toBeGreaterThan(at(COLLECTIBLE_TROUGH));
    expect(at(COLLECTIBLE_TROUGH + 10)).toBeGreaterThan(
      retainedShare('strong', COLLECTIBLE_TROUGH + 10),
    );
  });

  it('prices a classic as a collector would, and it gains in real terms', () => {
    const mestang = facts('car.fard-mestang-67-fastback.gt-390');
    const base = {
      ...mestang,
      modelYear: 1967,
      condition: 75,
      history: 'full' as const,
      accident: false,
    };
    expect(vehicleValueOf(base, 2050)).toBeGreaterThan(vehicleValueOf(base, 2030));
  });

  it('reads condition, service history and an accident, and never a mileage', () => {
    const { model, trim } = facts(CAMDEN);
    const ordinary = {
      model,
      trim,
      modelYear: 2020,
      condition: expectedCondition(5),
      history: 'patchy' as const,
      accident: false,
    };
    const base = vehicleValueOf(ordinary, 2025);
    expect(
      vehicleValueOf({ ...ordinary, condition: ordinary.condition + 20 }, 2025),
    ).toBeGreaterThan(base);
    expect(vehicleValueOf({ ...ordinary, condition: ordinary.condition - 30 }, 2025)).toBeLessThan(
      base,
    );
    expect(vehicleValueOf({ ...ordinary, history: 'full' }, 2025)).toBeGreaterThan(base);
    expect(vehicleValueOf({ ...ordinary, history: 'none' }, 2025)).toBeLessThan(base);
    expect(vehicleValueOf({ ...ordinary, accident: true }, 2025)).toBeLessThan(base);
    // An ordinary example is worth the curve, within rounding.
    expect(Math.abs(base / (trim.price * retainedShare(model.retention, 5)) - 1)).toBeLessThan(
      0.01,
    );
    expect(Object.keys(owned())).not.toContain('mileage');
  });

  it('reads the four condition words off the number', () => {
    expect(conditionLabelOf(100)).toBe('excellent');
    expect(conditionLabelOf(70)).toBe('good');
    expect(conditionLabelOf(45)).toBe('fair');
    expect(conditionLabelOf(10)).toBe('poor');
  });
});

describe('0504 — a year of owning one', () => {
  it('costs more to keep as it ages, and more for a less reliable model', () => {
    const camden = facts(CAMDEN);
    const fiveLine = facts(FIVE_LINE);
    expect(maintenanceFor(camden.model, camden.trim, 10, 70)).toBeGreaterThan(
      maintenanceFor(camden.model, camden.trim, 1, 98),
    );
    expect(maintenanceFor(fiveLine.model, fiveLine.trim, 5, 80)).toBeGreaterThan(
      maintenanceFor(camden.model, camden.trim, 5, 80),
    );
    // An ordinary car, an ordinary year: hundreds, not thousands.
    const typical = maintenanceFor(camden.model, camden.trim, 6, 75);
    expect(typical).toBeGreaterThan(400);
    expect(typical).toBeLessThan(1_600);
  });

  it('pays a loan off over its term, and the last payment clears it', () => {
    let car = owned({
      loan: {
        productId: 'auto.new',
        principal: dollars(25_000),
        balance: dollars(25_000),
        termLeft: 6,
      },
    });
    let paidOff = false;
    let years = 0;
    for (let year = 2031; year < 2040 && !paidOff; year += 1) {
      const owedBefore = Number(car.loan?.balance ?? 0);
      const result = vehicleYear(car, facts(CAMDEN), year, ROLLS);
      expect(result.payment).toBeGreaterThan(0);
      paidOff = result.paidOff;
      car = result.vehicle;
      years += 1;
      // Every payment takes something off what is owed.
      if (!paidOff) expect(Number(car.loan!.balance)).toBeLessThan(owedBefore);
    }
    expect(paidOff).toBe(true);
    expect(years).toBe(6);
    expect(car.loan).toBeUndefined();
  });

  it('brings a hidden issue out in the first year, as a repair, once', () => {
    const car = owned({ defect: { part: 'transmission', cost: 3_200 } });
    const first = vehicleYear(car, facts(CAMDEN), 2031, ROLLS);
    expect(first.event).toBe('defect');
    expect(first.maintenance).toBeGreaterThanOrEqual(3_200);
    expect(first.vehicle.defect).toBeUndefined();
    const second = vehicleYear(first.vehicle, facts(CAMDEN), 2032, ROLLS);
    expect(second.event).toBeUndefined();
  });

  it('wears out, and goes to the junkyard once there is nothing owed on it', () => {
    let car = owned({ modelYear: 2000, boughtYear: 2010, condition: 30, history: 'none' });
    let finished = false;
    for (let year = 2020; year < 2060 && !finished; year += 1) {
      const result = vehicleYear(car, facts(CAMDEN), year, ROLLS);
      finished = result.finished;
      car = result.vehicle;
    }
    expect(finished).toBe(true);
    expect(car.condition).toBeLessThan(SCRAPPED_BELOW);
  });

  it('tells the car screen its monthly cost: the payment and ordinary maintenance (spec 20)', () => {
    const paidFor = owned();
    const financed = owned({
      loan: {
        productId: 'auto.new',
        principal: dollars(25_000),
        balance: dollars(25_000),
        termLeft: 6,
      },
    });
    expect(monthlyCostOf(financed, facts(CAMDEN), 2031)).toBeGreaterThan(
      monthlyCostOf(paidFor, facts(CAMDEN), 2031) + 300,
    );
  });
});

describe('0504 — car loans, instant approve or deny', () => {
  const buyer = (over: Partial<CarBuyer> = {}): CarBuyer => ({
    age: 30,
    standing: 'good',
    income: 60_000,
    cash: 8_000,
    otherPayments: 0,
    ...over,
  });

  it('approves an ordinary buyer on an ordinary car, at the new-car rate only for a new one', () => {
    const fresh = carLoanFor(30_000, true, buyer());
    expect(fresh.approved).toBe(true);
    expect(fresh.product?.id).toBe('auto.new');
    const used = carLoanFor(18_000, false, buyer());
    expect(used.approved).toBe(true);
    expect(used.product?.id).toBe('auto.used');
    expect(used.product!.apr).toBeGreaterThan(fresh.product!.apr);
  });

  it('lends to somebody with no credit history, at a price — the way most first cars are bought', () => {
    const first = carLoanFor(
      12_000,
      false,
      buyer({ standing: 'none', income: 30_000, cash: 2_500 }),
    );
    expect(first.approved).toBe(true);
    expect(first.product?.id).toBe('auto.second-chance');
  });

  it('says no for a reason it can name', () => {
    expect(carLoanFor(20_000, false, buyer({ age: 17 })).because).toBe('tooYoung');
    expect(carLoanFor(20_000, false, buyer({ income: 0 })).because).toBe('noIncome');
    expect(carLoanFor(20_000, false, buyer({ cash: 500 })).because).toBe('deposit');
    expect(carLoanFor(90_000, true, buyer({ income: 40_000, cash: 20_000 })).because).toBe(
      'income',
    );
    expect(carLoanFor(900_000, true, buyer({ income: 2_000_000, cash: 50_000 })).because).toBe(
      'tooLarge',
    );
  });

  it('keeps the payment under its share of income', () => {
    const offer = carLoanFor(35_000, true, buyer({ income: 70_000, cash: 10_000 }));
    expect(offer.approved).toBe(true);
    expect(offer.yearlyPayment).toBeLessThanOrEqual(70_000 * CAR_PAYMENT_CEILING);
  });
});

describe('0504 — selling, and what is owed', () => {
  it('sells to a dealer under value, and can leave somebody owing', () => {
    const car = owned({ value: dollars(20_000) });
    expect(vehicleSaleOf(car).price).toBe(Math.round(20_000 * TRADE_IN));
    const underwater = owned({
      value: dollars(10_000),
      loan: {
        productId: 'auto.used',
        principal: dollars(15_000),
        balance: dollars(14_000),
        termLeft: 4,
      },
    });
    expect(vehicleSaleOf(underwater).proceeds).toBeLessThan(0);
    expect(vehicleSaleOf(underwater, true).price).toBe(Math.round(10_000 * REPOSSESSED_SALE));
  });

  it('adds up what the cars are worth and what is owed on them', () => {
    const cars = [
      owned({ value: dollars(10_000) }),
      owned({
        id: 'b',
        value: dollars(5_000),
        loan: {
          productId: 'auto.used',
          principal: dollars(6_000),
          balance: dollars(4_000),
          termLeft: 3,
        },
      }),
    ];
    expect(Number(vehiclesValue(cars))).toBe(1_500_000);
    expect(Number(vehicleLoansOwed(cars))).toBe(400_000);
  });
});

describe('0504 — the living bill stops buying a car for somebody who owns one', () => {
  const base = {
    standard: 50_000,
    locationIndex: 1,
    partnered: false,
    childAges: [],
    housing: 'ownPlace' as const,
  };

  it('replaces only the actual running cost up to the P2 dollar allowance', () => {
    const none = livingCostFor(base).total;
    expect(none).toBe(50_000);
    expect(livingCostFor({ ...base, ownsVehicle: true, vehicleCost: 1_000 }).total).toBe(49_000);
  });

  it('makes an expensive car an additional real expense after the P2 allowance', () => {
    const dear = livingCostFor({ ...base, ownsVehicle: true, vehicleCost: 12_000 }).total;
    expect(dear).toBe(48_400);
    expect(dear + 12_000).toBe(60_400);
  });

  it('finds the model the tests above name', () => {
    expect(findVehicleModel('car.royata-camden')?.retention).toBe('strong');
  });
});

describe('0505 — modifications', () => {
  const mod = (id: string) => {
    const found = findVehicleMod(id);
    if (!found) throw new Error(id);
    return found;
  };
  const CIVIX = 'car.hondo-civix.si';
  const GELANDER = 'car.merceda-gelander.g-63-amr';
  const MODEL_TRI = 'car.teslo-model-tri.long-range';
  const MESTANG = 'car.fard-mestang-67-fastback.289';
  const car = (trimId: string, over: Partial<OwnedVehicle> = {}): OwnedVehicle =>
    owned({ trimId, modelYear: 2030, boughtYear: 2030, condition: 100, ...over });

  it('prices a part for the car it goes on: a Hondo pays the low end, a Ferrano the high', () => {
    const wheels = mod('mod.wheels.forged');
    const civic = modPriceOf(wheels, facts(CIVIX).trim);
    const rbw = modPriceOf(wheels, facts('car.rbw-3-line.r3').trim);
    const ferrano = modPriceOf(wheels, facts('car.ferrano-rona.coupe').trim);
    expect(civic).toBeGreaterThanOrEqual(wheels.price[0]);
    expect(civic).toBeLessThan(rbw);
    expect(rbw).toBeLessThan(ferrano);
    expect(ferrano).toBeLessThanOrEqual(wheels.price[1]);
    // Tarbus is a share of the car.
    expect(modPriceOf(mod('mod.tarbus'), facts(GELANDER).trim)).toBe(
      Math.round((facts(GELANDER).trim.price * 0.4) / 500) * 500,
    );
  });

  it('refuses what a car cannot have, and says why', () => {
    const tesla = facts(MODEL_TRI).model;
    expect(modRefusalFor(mod('mod.exhaust.cat-back'), tesla, car(MODEL_TRI))).toBe('notForThisCar');
    expect(modRefusalFor(mod('mod.wheels.forged'), tesla, car(MODEL_TRI))).toBeUndefined();
    const civic = facts(CIVIX).model;
    expect(modRefusalFor(mod('mod.brakes.carbon'), civic, car(CIVIX))).toBe('notForThisCar');
    expect(modRefusalFor(mod('mod.tarbus'), civic, car(CIVIX))).toBe('notForThisCar');
    // Not every luxury car either: Tarbus converts the models it is known for.
    const rbw = facts('car.rbw-3-line.r3').model;
    expect(rbw.market).toBe('luxury');
    expect(modRefusalFor(mod('mod.tarbus'), rbw, car('car.rbw-3-line.r3'))).toBe('notForThisCar');
    const g = facts(GELANDER).model;
    const converted = withMod(car(GELANDER), mod('mod.tarbus'), 74_000, 2030);
    expect(modRefusalFor(mod('mod.exhaust.cat-back'), g, converted)).toBe('coveredByTarbus');
    expect(modRefusalFor(mod('mod.tarbus'), g, converted)).toBe('alreadyFitted');
    // Tarbus does not touch the paint or the tint.
    expect(modRefusalFor(mod('mod.tint.windows'), g, converted)).toBeUndefined();
  });

  it('fits one thing per slot: a wrap replaces the paint, and Tarbus replaces what it covers', () => {
    let civic = withMod(car(CIVIX), mod('mod.finish.respray'), 3_500, 2030);
    civic = withMod(civic, mod('mod.finish.wrap-matte-black'), 3_000, 2031);
    expect(civic.mods?.map((entry) => entry.modId)).toEqual(['mod.finish.wrap-matte-black']);
    let g = withMod(car(GELANDER), mod('mod.exhaust.cat-back'), 4_000, 2030);
    g = withMod(g, mod('mod.tint.windows'), 500, 2030);
    g = withMod(g, mod('mod.tarbus'), 74_000, 2031);
    expect(g.mods?.map((entry) => entry.modId).sort()).toEqual(['mod.tarbus', 'mod.tint.windows']);
    expect(hasTarbus(g)).toBe(true);
  });

  it('adds only part of the cost to what the car is worth, and that part ages with the car', () => {
    const stock = car(CIVIX);
    const base = vehicleWorthOf(stock, facts(CIVIX), 2030);
    const wheels = withMod(stock, mod('mod.wheels.forged'), 4_000, 2030);
    const added = vehicleWorthOf(wheels, facts(CIVIX), 2030) - base;
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThan(4_000 * 0.5);
    // Five years on, the wheels are worth less too.
    const later = (vehicle: OwnedVehicle) => vehicleWorthOf(vehicle, facts(CIVIX), 2035);
    expect(later(wheels) - later(stock)).toBeLessThan(added);
    expect(later(wheels) - later(stock)).toBeGreaterThan(0);
    // A tune adds nothing at all: a buyer reads it as a voided warranty.
    const tuned = withMod(stock, mod('mod.ecu.stage-1'), 800, 2030);
    expect(vehicleWorthOf(tuned, facts(CIVIX), 2030)).toBe(base);
  });

  it('holds a Tarbus conversion’s value far better than a shop’s work', () => {
    const g = car(GELANDER);
    const base = vehicleWorthOf(g, facts(GELANDER), 2030);
    const cost = modPriceOf(mod('mod.tarbus'), facts(GELANDER).trim);
    const converted = vehicleWorthOf(
      withMod(g, mod('mod.tarbus'), cost, 2030),
      facts(GELANDER),
      2030,
    );
    expect((converted - base) / cost).toBeGreaterThan(0.6);
    expect(converted - base).toBeLessThan(cost);
  });

  it('makes a classic worth less for every change (collectors pay for original)', () => {
    const mestang = car(MESTANG, { modelYear: 1967, condition: 75 });
    const base = vehicleWorthOf(mestang, facts(MESTANG), 2030);
    const wheels = withMod(mestang, mod('mod.wheels.alloy'), 1_500, 2030);
    expect(vehicleWorthOf(wheels, facts(MESTANG), 2030)).toBeLessThan(base);
  });

  it('works a tuned car harder and keeps a car with good brakes out of trouble', () => {
    const stock = car(CIVIX);
    const tuned = withMod(
      withMod(stock, mod('mod.ecu.stage-2'), 1_500, 2030),
      mod('mod.engine.turbo'),
      5_000,
      2030,
    );
    expect(strainOf(tuned)).toBeGreaterThan(1.2);
    expect(monthlyCostOf(tuned, facts(CIVIX), 2031)).toBeGreaterThan(
      monthlyCostOf(stock, facts(CIVIX), 2031),
    );
    const quiet = { ...ROLLS, repair: 0.99 };
    expect(vehicleYear(tuned, facts(CIVIX), 2031, quiet).maintenance).toBeGreaterThan(
      vehicleYear(stock, facts(CIVIX), 2031, quiet).maintenance,
    );
    const braked = withMod(stock, mod('mod.brakes.big-brake'), 2_000, 2030);
    expect(gripOf(braked)).toBeLessThan(1);
    // A roll that is a crash for a stock car is not one with the brakes.
    const roll = { ...ROLLS, accident: 0.027 };
    expect(vehicleYear(stock, facts(CIVIX), 2031, roll).event).toBe('accident');
    expect(vehicleYear(braked, facts(CIVIX), 2031, roll).event).not.toBe('accident');
  });

  it('carries what was fitted through a year of owning it', () => {
    const wheels = withMod(car(CIVIX), mod('mod.wheels.forged'), 4_000, 2030);
    const next = vehicleYear(wheels, facts(CIVIX), 2031, ROLLS).vehicle;
    expect(next.mods).toEqual(wheels.mods);
    expect(Number(next.value) / 100).toBe(vehicleWorthOf(next, facts(CIVIX), 2031));
  });
});
