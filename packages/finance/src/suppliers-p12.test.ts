import { describe, it, expect } from 'vitest';
import { findBusinessType } from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import { newBusiness, businessYear, SUPPLIER_EFFECTS } from './businesses';
import { supplierPitch, supplierModifiers, SUPPLIER_LOYALTIES } from './suppliers';
import { BUSINESS_EVENTS, modifiersFor } from './business-events';
const type = findBusinessType('biz.restaurant')!;
const b = newBusiness(type, 'biz:p12', 'Restaurant', 2000, 1);
describe('P12 actual finance rules', () => {
  it('quotes independent, rounded anchored cost/quality and three independent loyalty levels', () => {
    const grades = new Set();
    const loyalty = new Set();
    for (let i = 0; i < 1000; i++) {
      const p = supplierPitch(String(i), 'biz:p12', 2030, 1);
      const key = `p12-pitch:${i}:biz:p12:2030:1`;
      const anchor = SUPPLIER_EFFECTS[p.grade];
      grades.add(p.grade);
      loyalty.add(p.loyalty);
      expect(p.cost).toBe(
        Math.round(anchor.cost * (0.97 + 0.06 * mixedUnit(`${key}:cost`)) * 100) / 100,
      );
      expect(p.quality).toBe(
        Math.round(anchor.quality * (0.98 + 0.04 * mixedUnit(`${key}:quality`)) * 100) / 100,
      );
      expect(p.grade).toBe(
        ['budget', 'standard', 'premium'][Math.floor(mixedUnit(`${key}:grade`) * 3)],
      );
      expect(p.loyalty).toBe(SUPPLIER_LOYALTIES[Math.floor(mixedUnit(`${key}:loyalty`) * 3)]);
      expect(p.name.trim().length).toBeGreaterThan(0);
    }
    expect(grades.size).toBe(3);
    expect(loyalty.size).toBe(3);
  });
  it.each(SUPPLIER_LOYALTIES)(
    'protects only the supplier-hike extra surcharge for %s loyalty',
    (loyalty) => {
      const agreement = { ...supplierPitch('terms', b.id, 2030, 1), loyalty, acceptedYear: 2030 };
      const held = { ...b, supplier: agreement.grade, supplierAgreement: agreement };
      for (const event of BUSINESS_EVENTS)
        for (const size of [0, 0.5, 1]) {
          const happened = { event, size };
          const base = modifiersFor(happened);
          const expected =
            event.id === 'supplier-hike'
              ? {
                  ...base,
                  cogs: 1 + (base.cogs - 1) * (1 - { low: 0, medium: 0.25, high: 0.5 }[loyalty]),
                }
              : base;
          expect(supplierModifiers(held, happened)).toEqual(expected);
          expect(supplierModifiers(b, happened)).toEqual(base);
        }
      expect(supplierModifiers(held, undefined)).toEqual(modifiersFor(undefined));
    },
  );
  it('uses accepted quality in demand and reputation and cost per sold unit, without changing generic anchors', () => {
    const input = { year: 2030, market: 'normal' as const, shock: 0, stat: 50, hands: 1 };
    const generic = businessYear({ ...b, staff: 100 }, type, input);
    const p = {
      ...supplierPitch('terms', b.id, 2029, 1),
      grade: 'standard' as const,
      cost: 1.03,
      quality: 1.02,
      acceptedYear: 2029,
    };
    const held = businessYear({ ...b, staff: 100, supplierAgreement: p }, type, input);
    expect(held.demand / generic.demand).toBeCloseTo(
      1.02 ** (type.productShare * type.elasticity),
      10,
    );
    expect(held.cogs).toBe(Math.round(Math.min(held.demand, held.capacity) * type.cogs * 1.03));
    expect(held.reputation).toBeGreaterThan(generic.reputation);
    expect(Math.abs(held.profit - (held.revenue - held.costs))).toBeLessThanOrEqual(1);
  });
});
