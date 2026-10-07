import { describe, expect, it } from 'vitest';
import {
  livingCostFor,
  standardTargetFor,
  lifestyleStandardFor,
  LIFESTYLES,
  SUBSISTENCE,
} from './living';
const base = {
  standard: 50_000,
  locationIndex: 1,
  partnered: false,
  childAges: [],
  housing: 'ownPlace' as const,
};
describe('P2 — approved curve and lifestyle spending', () => {
  it.each([
    [0, 18_600],
    [18_600, 18_600],
    [50_000, 47_488],
    [120_000, 75_488],
    [165_000, 82_238],
    [220_000, 90_488],
  ])('after-tax income %s has literal target %s', (income, target) => {
    expect(standardTargetFor(income, 0)).toBe(target);
  });
  it('tapers wealth continuously but still counts a portfolio-sized fortune', () => {
    expect(standardTargetFor(165_000, 100_000)).toBe(84_038);
    expect(standardTargetFor(165_000, 1_000_000)).toBeCloseTo(87_930.099788, 5);
    expect(standardTargetFor(165_000, -1)).toBe(82_238);
    expect(standardTargetFor(165_000, 100_001)).toBeGreaterThan(84_038);
  });
  it.each([
    ['frugal', 43_720],
    ['comfortable', 50_000],
    ['lavish', 65_700],
  ] as const)('%s scales extras without cutting basic needs', (lifestyle, total) => {
    expect(livingCostFor({ ...base, lifestyle }).total).toBe(total);
    expect(lifestyleStandardFor(50_000, lifestyle)).toBe(total);
    expect(livingCostFor({ ...base, standard: SUBSISTENCE, lifestyle }).total).toBe(18_600);
  });
  it('pins the approved annual nudges independently of the spending constants', () => {
    expect(Object.values(LIFESTYLES).map((tier) => tier.happiness)).toEqual([-1, 0, 2]);
  });
  it('scales the chosen life with location, household and housing', () => {
    expect(
      livingCostFor({
        ...base,
        lifestyle: 'lavish',
        locationIndex: 1.2,
        partnered: true,
        childAges: [8],
        housing: 'withFamily',
      }).total,
    ).toBe(49_858);
  });
  it('preserves the mortgage squeeze and owner floor across tiers', () => {
    expect(
      livingCostFor({ ...base, lifestyle: 'lavish', housing: 'owned', housingCost: 30_000 }).total,
    ).toBe(35_700);
    expect(
      livingCostFor({ ...base, lifestyle: 'frugal', housing: 'owned', housingCost: 100_000 }).total,
    ).toBe(13_020);
  });
  it.each([0, 100, 1_000, 1_600, 5_500, 12_000])(
    'car cost %s replaces only real dollars up to $1,600',
    (vehicleCost) => {
      const cost = livingCostFor({ ...base, ownsVehicle: true, vehicleCost }).total;
      expect(cost).toBe(50_000 - Math.min(vehicleCost, 1_600));
      expect(cost + vehicleCost).toBe(50_000 + Math.max(0, vehicleCost - 1_600));
    },
  );
  it('does not give a wealthy or lavish car owner a larger discount', () => {
    for (const standard of [50_000, 150_000, 500_000]) {
      for (const lifestyle of ['frugal', 'comfortable', 'lavish'] as const) {
        const input = { ...base, standard, lifestyle };
        expect(
          livingCostFor(input).total -
            livingCostFor({ ...input, ownsVehicle: true, vehicleCost: 8_000 }).total,
        ).toBe(1_600);
      }
    }
  });
  it('scales transport dollars with household, location and roof, not tier', () => {
    const input = { ...base, locationIndex: 1.2, partnered: true, housing: 'owned' as const };
    expect(
      livingCostFor(input).total -
        livingCostFor({ ...input, ownsVehicle: true, vehicleCost: 8_000 }).total,
    ).toBe(2_016);
    expect(livingCostFor({ ...base, vehicleCost: 8_000 }).total).toBe(50_000);
  });
});
