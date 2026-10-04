/**
 * Ticket 0504 — the vehicle catalog.
 *
 * Spec 1703: 150–250 initial entries/variants. Spec 1088 and 1456: truly
 * identifiable fictional brand/model families with multiple trims, priced
 * against real-world bands. Spec 1877: New, Used, Online and Luxury markets,
 * two lots in each new/used bracket and two smaller luxury lots.
 */

import { describe, expect, it } from 'vitest';
import {
  VEHICLE_LOTS,
  VEHICLE_MODELS,
  VEHICLE_MODS,
  VEHICLE_MOD_SLOTS,
  findVehicleMod,
  VEHICLE_TRIM_COUNT,
  findVehicleLot,
  findVehicleModel,
  findVehicleTrim,
  vehicleName,
} from './vehicles';

/**
 * Real marques. A catalog that ships one of these by accident is a legal
 * problem, not a style one — the analogues are meant to be recognised, never
 * to be the thing itself.
 */
const REAL_BRANDS = [
  'Toyota',
  'Honda',
  'Ford',
  'Chevrolet',
  'Chevy',
  'Nissan',
  'Hyundai',
  'Kia',
  'Subaru',
  'Mazda',
  'Volkswagen',
  'Jeep',
  'Ram',
  'Dodge',
  'Tesla',
  'BMW',
  'Mercedes',
  'Benz',
  'Audi',
  'Lexus',
  'Cadillac',
  'Land Rover',
  'Range Rover',
  'Porsche',
  'Ferrari',
  'Lamborghini',
  'McLaren',
  'Bentley',
  'Rolls-Royce',
  'Aston Martin',
  'Plymouth',
  'Datsun',
  'Brabus',
];

describe('0504 — the vehicle catalog', () => {
  it('holds 150–250 entries across many models, as spec 1703 asks', () => {
    expect(VEHICLE_TRIM_COUNT).toBeGreaterThanOrEqual(150);
    expect(VEHICLE_TRIM_COUNT).toBeLessThanOrEqual(250);
    expect(VEHICLE_MODELS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(VEHICLE_MODELS.map((model) => model.brand)).size).toBeGreaterThanOrEqual(20);
  });

  it('uses no real brand name anywhere a player reads', () => {
    for (const model of VEHICLE_MODELS) {
      for (const trim of model.trims) {
        const name = `${vehicleName(model, trim)} ${model.blurb}`;
        for (const brand of REAL_BRANDS) {
          expect(new RegExp(`\\b${brand}\\b`).test(name), `${brand} in "${name}"`).toBe(false);
        }
      }
    }
    for (const lot of VEHICLE_LOTS) {
      for (const brand of REAL_BRANDS) expect(lot.name.includes(brand), lot.name).toBe(false);
    }
  });

  it('gives most families more than one trim (spec 1456: multiple trims and variants)', () => {
    const sold = VEHICLE_MODELS.filter((model) => model.market !== 'classic');
    const several = sold.filter((model) => model.trims.length >= 2);
    expect(several.length / sold.length).toBeGreaterThan(0.85);
  });

  it('prices each tier inside its real-world band', () => {
    for (const model of VEHICLE_MODELS) {
      for (const trim of model.trims) {
        const band =
          model.market === 'mainstream'
            ? [18_000, 125_000]
            : model.market === 'luxury'
              ? [40_000, 250_000]
              : model.market === 'exotic'
                ? [100_000, 1_000_000]
                : [15_000, 3_000_000];
        expect(trim.price, `${model.id} ${trim.name}`).toBeGreaterThanOrEqual(band[0]!);
        expect(trim.price, `${model.id} ${trim.name}`).toBeLessThanOrEqual(band[1]!);
      }
      // Within a family, trims climb.
      for (let i = 1; i < model.trims.length; i += 1) {
        expect(model.trims[i]!.price, model.id).toBeGreaterThanOrEqual(model.trims[i - 1]!.price);
      }
    }
  });

  it('dates every classic and only classics, and marks them collectible', () => {
    for (const model of VEHICLE_MODELS) {
      expect(model.year !== undefined, model.id).toBe(model.market === 'classic');
      if (model.market === 'classic') expect(model.collectible).toBe(true);
    }
    // Spec 1387: SELECT collector cars appreciate — a few, not all of them.
    const modern = VEHICLE_MODELS.filter((model) => model.market !== 'classic');
    const collectible = modern.filter((model) => model.collectible);
    expect(collectible.length).toBeGreaterThan(0);
    expect(collectible.length / modern.length).toBeLessThan(0.1);
  });

  it('has the four markets and the lots spec 1877 names', () => {
    const count = (market: string) => VEHICLE_LOTS.filter((lot) => lot.market === market).length;
    expect(count('new')).toBe(2);
    expect(count('used')).toBe(2);
    expect(count('online')).toBe(1);
    expect(count('luxury')).toBe(2);
    // The luxury lots are the smaller ones.
    const largest = Math.max(
      ...VEHICLE_LOTS.filter((lot) => lot.market === 'luxury').map((lot) => lot.size),
    );
    const smallest = Math.min(
      ...VEHICLE_LOTS.filter((lot) => lot.market !== 'luxury').map((lot) => lot.size),
    );
    expect(largest).toBeLessThan(smallest);
    for (const lot of VEHICLE_LOTS) {
      expect(
        VEHICLE_MODELS.some((model) => lot.markets.includes(model.market)),
        lot.id,
      ).toBe(true);
      expect(findVehicleLot(lot.id)).toBe(lot);
    }
  });

  it('keeps hidden issues uncommon, and commonest online (spec 1329, 1387)', () => {
    const online = VEHICLE_LOTS.find((lot) => lot.market === 'online')!;
    for (const lot of VEHICLE_LOTS) {
      expect(lot.defectChance).toBeLessThanOrEqual(0.1);
      if (lot.age[1] === 0) expect(lot.defectChance).toBe(0);
      expect(lot.defectChance).toBeLessThanOrEqual(online.defectChance);
    }
  });

  it('finds every model and trim by id', () => {
    for (const model of VEHICLE_MODELS) {
      expect(findVehicleModel(model.id)).toBe(model);
      for (const trim of model.trims) expect(findVehicleTrim(trim.id)?.trim).toBe(trim);
    }
  });
});

describe('0505 — the modification catalog', () => {
  it('offers spec 184’s list and nothing else', () => {
    const slots = new Set(VEHICLE_MODS.map((mod) => mod.slot));
    for (const slot of VEHICLE_MOD_SLOTS) expect(slots.has(slot), slot).toBe(true);
    // Spec 1885 removes body styling and interiors by name.
    for (const mod of VEHICLE_MODS) {
      expect(/body kit|spoiler|interior|seat|steering wheel|bumper/i.test(mod.name), mod.name).toBe(
        false,
      );
    }
    // Concise: a handful of options, not a parts catalog.
    expect(VEHICLE_MODS.length).toBeLessThanOrEqual(24);
  });

  it('keeps wraps intentionally limited (spec 184)', () => {
    const wraps = VEHICLE_MODS.filter((mod) => /wrap|stripes/i.test(mod.name));
    expect(wraps.length).toBeGreaterThan(0);
    expect(wraps.length).toBeLessThanOrEqual(3);
  });

  it('recovers only part of the cost of every modification (spec 1387)', () => {
    for (const mod of VEHICLE_MODS) expect(mod.recovery, mod.id).toBeLessThan(1);
    const ordinary = VEHICLE_MODS.filter((mod) => mod.slot !== 'tarbus');
    expect(ordinary.every((mod) => mod.recovery <= 0.4)).toBe(true);
    // The elite house holds its value better than anything a shop fits.
    const tarbus = findVehicleMod('mod.tarbus')!;
    expect(ordinary.every((mod) => mod.recovery < tarbus.recovery)).toBe(true);
  });

  it('lets Tarbus convert only suitable luxury cars (spec 1885)', () => {
    const suitable = VEHICLE_MODELS.filter((model) => model.tarbus);
    expect(suitable.length).toBeGreaterThan(0);
    for (const model of suitable) {
      expect(['luxury', 'exotic']).toContain(model.market);
      expect(model.brand === 'Merceda' || model.brand === 'Porsha').toBe(true);
    }
    expect(findVehicleMod('mod.tarbus')?.name).toBe('Tarbus conversion');
  });
});
