import { describe, expect, it } from 'vitest';
import { retirementSpendingFor, standardTargetFor, livingCostFor } from './living';
const input = {
  age: 75,
  retired: true,
  afterTaxIncome: 0,
  liquidWealth: 512000,
  personalDebt: 0,
  locationIndex: 1,
  partnered: false,
  childAges: [],
  housing: 'ownPlace' as const,
};
describe('P15 literal later-retirement policy', () => {
  it('keeps a bill reserve and spreads half of savings over 25 years at 75', () => {
    const p = retirementSpendingFor(input);
    expect(p.horizon).toBe(25);
    expect(p.reserve).toBe(12000);
    expect(p.savingsYear).toBe(10000);
    expect(p.target).toBe(28600);
  });
  it.each([
    [85, 15, 16666.666666666668],
    [92, 8, 31250],
    [105, 8, 31250],
  ])('keeps a finite safe horizon at %s', (age, horizon, budget) => {
    const p = retirementSpendingFor({ ...input, age });
    expect(p.horizon).toBe(horizon);
    expect(p.savingsYear).toBe(budget);
  });
  it.each([{ age: 74 }, { retired: false }])(
    'preserves the ordinary P2 target outside eligibility %j',
    (change) => {
      const p = retirementSpendingFor({ ...input, ...change });
      expect(p.target).toBe(standardTargetFor(0, 512000));
      expect(p.savingsYear).toBe(0);
      expect(p.horizon).toBeUndefined();
    },
  );
  it('excludes debt from the spending pool without treating unused credit as wealth', () => {
    const p = retirementSpendingFor({ ...input, personalDebt: 250000 });
    expect(p.savingsYear).toBe(5000);
    expect(p.target).toBe(23600);
  });
  it.each([0, 1000, 12000])('does not invent extra comforts with only %s saved', (liquidWealth) => {
    const p = retirementSpendingFor({ ...input, liquidWealth });
    expect(p.savingsYear).toBe(0);
    expect(p.target).toBe(standardTargetFor(0, liquidWealth));
  });
  it('retains basic needs and never treats a negative balance as spending money', () => {
    expect(retirementSpendingFor({ ...input, liquidWealth: -100000 }).savingsYear).toBe(0);
    expect(retirementSpendingFor({ ...input, personalDebt: 1000000 }).savingsYear).toBe(0);
  });
  it('reserves six months of the whole recurring bill for an affluent household', () => {
    const p = retirementSpendingFor({
      ...input,
      afterTaxIncome: 165000,
      liquidWealth: 1000000,
      housingCost: 20000,
      vehicleCost: 10000,
      ownsVehicle: true,
    });
    const ordinary = standardTargetFor(165000, 1000000);
    const cost = livingCostFor({
      ...input,
      standard: ordinary,
      ownsVehicle: true,
      vehicleCost: 10000,
    }).total;
    expect(p.reserve).toBe((cost + 30000) / 2);
    expect(p.savingsYear).toBe(((1000000 - p.reserve) * 0.5) / 25);
  });
  it('normalizes the savings allowance once through household, location and housing', () => {
    const p = retirementSpendingFor({
      ...input,
      partnered: true,
      locationIndex: 2,
      housing: 'owned',
      housingCost: 5000,
    });
    const base = standardTargetFor(0, 512000 / 1.5);
    const ordinary = livingCostFor({
      ...input,
      partnered: true,
      locationIndex: 2,
      housing: 'owned',
      housingCost: 5000,
      standard: base,
    }).total;
    expect(p.reserve).toBe(Math.max(12000, (ordinary + 5000) / 2));
    expect(p.target).toBe(Math.max(base, 18600 + p.savingsYear / 2.1));
  });
});
