/**
 * Ticket 0506 — the rules of renovating a home and of owning valuables.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { findRenovation, findValuable, type Renovation, type Valuable } from '@yearafter/content';
import { CONDITION_PRICE, annualExpenseOf, type OwnedHome } from './property';
import { renovated, renovationCostOf, renovationRefusalFor } from './renovations';
import {
  DRIFT,
  FASHION_FLOOR,
  RESALE,
  resaleAtPurchase,
  valuableYear,
  valuablesMarketIn,
  type OwnedValuable,
} from './valuables';

const reno = (id: string): Renovation => findRenovation(id)!;
const item = (id: string): Valuable => findValuable(id)!;

const house = (over: Partial<OwnedHome> = {}): OwnedHome => ({
  id: 'home:2030:0',
  kindId: 'home.starter',
  beds: 3,
  baths: 2,
  builtYear: 1980,
  condition: 'poor',
  regionKey: 'US:OH',
  regionName: 'Ohio',
  purchasePrice: dollars(240_000),
  boughtYear: 2030,
  value: dollars(250_000),
  expenseRate: 0.022,
  behindYears: 0,
  ...over,
});

describe('0506 — renovating', () => {
  it('prices a refresh on the home and an addition on the region', () => {
    const cheap = renovationCostOf(reno('reno.kitchen-modern'), house({ value: dollars(150_000) }));
    const dear = renovationCostOf(
      reno('reno.kitchen-modern'),
      house({ value: dollars(1_200_000) }),
    );
    expect(dear).toBeGreaterThan(cheap * 3);
    // The floor: a kitchen is never trivially cheap.
    expect(cheap).toBeGreaterThanOrEqual(15_000);
    const pool = renovationCostOf(reno('reno.pool'), house());
    const californiaPool = renovationCostOf(reno('reno.pool'), house({ regionKey: 'US:CA' }));
    expect(californiaPool).toBeGreaterThan(pool);
  });

  it('lifts a refresh’s condition a step, and the value with it', () => {
    const home = house();
    const after = renovated(home, reno('reno.bath-modern'), 18_000, 2031);
    expect(after.condition).toBe('fair');
    expect(Number(after.value)).toBe(
      Math.round((250_000 * CONDITION_PRICE.fair) / CONDITION_PRICE.poor) * 100,
    );
    // Never past the top.
    const top = renovated(house({ condition: 'excellent' }), reno('reno.finishes'), 50_000, 2031);
    expect(top.condition).toBe('excellent');
  });

  it('never returns more than an addition cost (spec 1385)', () => {
    for (const id of [
      'reno.pool',
      'reno.observatory',
      'reno.maze',
      'reno.bedroom-1',
      'reno.wine-cellar',
    ]) {
      const home = house({ kindId: 'home.estate', condition: 'good' });
      const cost = renovationCostOf(reno(id), home);
      const added = Number(renovated(home, reno(id), cost, 2031).value) / 100 - 250_000;
      expect(added, id).toBeLessThan(cost);
      expect(added, id).toBeGreaterThan(0);
    }
  });

  it('cannot be looped: an addition once, a refresh again only after it has aged', () => {
    const home = house({ kindId: 'home.family' });
    const pooled = renovated(home, reno('reno.pool'), 65_000, 2031);
    expect(renovationRefusalFor(reno('reno.pool'), pooled, 2031)).toBe('alreadyDone');
    expect(renovationRefusalFor(reno('reno.pool'), pooled, 2080)).toBe('alreadyDone');
    const kitchen = renovated(home, reno('reno.kitchen-modern'), 25_000, 2031);
    expect(renovationRefusalFor(reno('reno.kitchen-modern'), kitchen, 2035)).toBe('tooSoon');
    expect(renovationRefusalFor(reno('reno.kitchen-modern'), kitchen, 2046)).toBeUndefined();
    // Modern to luxury is an upgrade, and can happen whenever.
    expect(renovationRefusalFor(reno('reno.kitchen-luxury'), kitchen, 2032)).toBeUndefined();
    const upgraded = renovated(kitchen, reno('reno.kitchen-luxury'), 75_000, 2032);
    expect(upgraded.renovations?.map((done) => done.renovationId)).toEqual(['reno.kitchen-luxury']);
  });

  it('respects what a home has room for', () => {
    expect(renovationRefusalFor(reno('reno.pool'), house({ kindId: 'home.condo' }), 2031)).toBe(
      'notForThisHome',
    );
    expect(renovationRefusalFor(reno('reno.maze'), house({ kindId: 'home.luxury' }), 2031)).toBe(
      'notForThisHome',
    );
    expect(
      renovationRefusalFor(reno('reno.bedroom-2'), house({ kindId: 'home.family' }), 2031),
    ).toBe('needsFirst');
    const added = renovated(house({ kindId: 'home.family' }), reno('reno.bedroom-1'), 90_000, 2031);
    expect(added.beds).toBe(4);
  });

  it('charges a pool every year after', () => {
    const home = house({ kindId: 'home.family', condition: 'good' });
    const pooled = renovated(home, reno('reno.pool'), 65_000, 2031);
    expect(annualExpenseOf(pooled) - annualExpenseOf({ ...pooled, renovations: [] })).toBe(3_000);
  });
});

describe('0506 — what a valuable is worth', () => {
  const owned = (itemId: string, value: number): OwnedValuable => ({
    id: `val:2030:store.watches:0`,
    itemId,
    boughtYear: 2030,
    purchasePrice: dollars(value),
    value: dollars(value),
  });

  it('is worth less than retail the day it is bought — except the watches with waiting lists', () => {
    expect(resaleAtPurchase(item('val.watch.casiot-g-shok'), 120)).toBe(
      Math.round(120 * RESALE.fashion),
    );
    expect(resaleAtPurchase(item('val.ring.solitaire-1-good'), 4_200)).toBeLessThan(4_200);
    expect(resaleAtPurchase(item('val.watch.rolux-subaquatic'), 10_250)).toBeGreaterThan(10_250);
  });

  it('lets fashion fall toward its floor, and holds the rest', () => {
    let fashion = owned('val.watch.fossell-chrono', 63);
    let gold = owned('val.chain.gold-cuban-14k', 2_760);
    for (let year = 2031; year < 2061; year += 1) {
      fashion = valuableYear(fashion, item('val.watch.fossell-chrono'), year, 's');
      gold = valuableYear(gold, item('val.chain.gold-cuban-14k'), year, 's');
    }
    expect(Number(fashion.value) / 100).toBe(Math.round(180 * FASHION_FLOOR));
    expect(Number(gold.value) / 100).toBeGreaterThan(2_760 * 0.4);
  });

  it('moves art far more than antiques, and the same way for everybody in a year', () => {
    expect(DRIFT.art.spread).toBeGreaterThan(DRIFT.antique.spread * 2);
    expect(valuablesMarketIn('art', 2040)).toBe(valuablesMarketIn('art', 2040));
    const swings = (id: string) => {
      const out: number[] = [];
      for (let year = 2031; year < 2231; year += 1) {
        const next = valuableYear(owned(id, 10_000), item(id), year, 'spread');
        out.push(Number(next.value) / 100 / 10_000 - 1);
      }
      const mean = out.reduce((a, b) => a + b, 0) / out.length;
      return Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length);
    };
    expect(swings('val.art.mid-landscape')).toBeGreaterThan(swings('val.antique.globe') * 2);
  });
});
