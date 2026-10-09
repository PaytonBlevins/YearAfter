import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { RENOVATIONS } from '@yearafter/content';
import { RENOVATION_CAPACITY, renovationSpaceFor, renovationHappinessOf } from './renovations';
import type { OwnedHome } from './property';
const expected = {
  'home.condo': 2,
  'home.townhouse': 4,
  'home.starter': 6,
  'home.family': 8,
  'home.large': 12,
  'home.luxury': 20,
  'home.estate': 30,
};
describe('P9 capacities', () => {
  it('uses precisely the approved home budgets', () => {
    expect(RENOVATION_CAPACITY).toEqual(expected);
  });
  it.each(Object.entries(expected))(
    'fits every eligible new individual addition in %s',
    (kindId, capacity) => {
      const home: OwnedHome = {
        id: 'home:2030:0',
        kindId,
        beds: 3,
        baths: 2,
        builtYear: 1980,
        condition: 'good',
        regionKey: 'US:OH',
        regionName: 'Ohio',
        purchasePrice: dollars(500000),
        boughtYear: 2030,
        value: dollars(500000),
        expenseRate: 0.02,
        behindYears: 0,
      };
      expect(renovationSpaceFor(home)).toEqual({ capacity, used: 0, remaining: capacity });
      expect(renovationHappinessOf(home)).toBe(0);
      for (const r of RENOVATIONS.slice(19).filter((r) => r.kinds.includes(kindId)))
        expect(r.space).toBeLessThanOrEqual(capacity);
      const old = RENOVATIONS.slice(0, 19).filter(
        (r) => r.kinds.includes(kindId) && r.id !== 'reno.infinity-pool',
      );
      const grandfathered = {
        ...home,
        renovations: old.map((r) => ({ renovationId: r.id, cost: 12345, year: 2029 })),
      };
      expect(renovationSpaceFor(grandfathered).used).toBeLessThanOrEqual(capacity);
    },
  );
});
