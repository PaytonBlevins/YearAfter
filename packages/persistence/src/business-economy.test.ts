import { expect, it } from 'vitest';
import { asSaveId, dollars } from '@yearafter/core';
import { newBusiness, reconcile, post } from '@yearafter/finance';
import {
  createNewGame,
  advanceYear,
  runBusinessesYear,
  businessMarket,
} from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';

it.each([0.844, 1.054])(
  'P4 preserves historical economy %s and continues with current rules',
  (economy) => {
    const base = createNewGame({ seed: 'p4-save' });
    const finance = post(base.finance, 2030, 40, {
      category: 'gift',
      amount: dollars(10_000_000 - Number(base.finance.balance) / 100),
      source: 'Save fixture funds',
    }).ledger;
    const adult = {
      ...base,
      finance,
      world: { ...base.world, year: 2030 },
      player: { ...base.player, age: 40, cash: finance.balance },
    };
    const type = businessMarket(adult).find((row) => row.id === 'biz.restaurant');
    if (!type) throw new Error('Missing restaurant');
    const business = {
      ...newBusiness(type, 'p4-fixed', 'Marlow', 2020, 1),
      staff: type.staff,
      reputation: 50,
      cash: dollars(2_000_000),
      last: {
        year: 2030,
        revenue: 900_000,
        costs: 800_000,
        profit: 100_000,
        drawn: 100_000,
        injected: 0,
        turnedAway: 0,
        idle: 0,
        economy,
      },
      profits: [100_000],
    };
    const state = { ...adult, businesses: [business] };
    const save = toSave(state, { id: asSaveId('p4-save'), createdAt: 0, updatedAt: 0 });
    expect(save.version).toBe(45);
    const restored = migrateSave(JSON.parse(JSON.stringify(save)));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error('Invalid save');
    const loaded = fromSave(restored.value);
    expect(loaded.businesses).toEqual(state.businesses);
    expect(loaded.businesses[0]?.last?.economy).toBe(economy);
    const future = runBusinessesYear({
      businesses: loaded.businesses,
      year: 2031,
      market: 'severeRecession',
      seed: loaded.rng.getSeed(),
      stat: () => 50,
      holdsJob: false,
      available: 0,
    });
    expect(future.businesses[0]?.last?.economy).toBeCloseTo(0.922, 12);
    expect(loaded.businesses[0]?.last?.economy).toBe(economy);
    const a = advanceYear(state).state;
    const b = advanceYear(loaded).state;
    expect(b.world.year).toBe(2031);
    expect(b.businesses).toEqual(a.businesses);
    expect(b.finance).toEqual(a.finance);
    expect(toSave(b, { id: asSaveId('p4-continued'), createdAt: 0, updatedAt: 0 }).rng).toEqual(
      toSave(a, { id: asSaveId('p4-continued'), createdAt: 0, updatedAt: 0 }).rng,
    );
    expect(reconcile(b.finance).ok).toBe(true);
  },
);
