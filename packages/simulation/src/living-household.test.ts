/**
 * Ticket 0502 — a household spends like a household.
 *
 * The standard of living a household drifts toward follows its income, and
 * the year's bill is that standard times the size of the household. Once a
 * partner's pay was part of the income, reading the standard off the WHOLE
 * household's income and then multiplying by the household again charged a
 * couple on $100,000 as if each of them earned it: measured, couples ran up
 * bills of $95,000 on $87,000 of pay and fell into the hardship cliff and out
 * again. The standard is now per member of the household (CORE_RULES 13.87).
 */

import { describe, expect, it } from 'vitest';
import type { HouseholdFinances } from '@yearafter/finance';
import { runLiving, type LivingPhaseInput } from './phases/living';

const BASE: Omit<LivingPhaseInput, 'household'> = {
  age: 40,
  locationIndex: 1,
  partnered: false,
  childAges: [],
  afterTaxIncome: 60_000,
  wealth: 20_000,
  credit: 0,
  portfolio: 0,
  earned: 70_000,
  toldToLeave: false,
  hasLivingParent: true,
};

/** Twenty years at the same income: long past the creep's settling time. */
const settle = (over: Partial<LivingPhaseInput>) => {
  let household: HouseholdFinances = {
    standard: 30_000,
    lifestyle: 'comfortable',
    housing: 'ownPlace',
    leftHomeAt: 22,
  };
  let last = runLiving({ ...BASE, household, ...over });
  for (let year = 0; year < 20; year += 1) {
    household = last.household;
    last = runLiving({ ...BASE, household, ...over });
  }
  return last;
};

describe('0502 — what a household of two spends', () => {
  it('spends less than it takes home, whatever its size', () => {
    for (const shape of [
      { partnered: false, childAges: [] },
      { partnered: true, childAges: [] },
      { partnered: true, childAges: [4, 9] },
      { partnered: true, childAges: [2, 8, 14] },
    ]) {
      const year = settle({ ...shape, afterTaxIncome: 100_000 });
      expect(year.hardship, JSON.stringify(shape)).toBe(false);
      expect(year.cost, JSON.stringify(shape)).toBeLessThan(100_000);
    }
  });

  it('still makes a family cost more than a person', () => {
    const alone = settle({ afterTaxIncome: 70_000 }).cost;
    const family = settle({ afterTaxIncome: 70_000, partnered: true, childAges: [3, 7] }).cost;
    expect(family).toBeGreaterThan(alone);
  });

  it('lives better on two incomes than on one', () => {
    const one = settle({ partnered: true, afterTaxIncome: 50_000 }).cost;
    const two = settle({ partnered: true, afterTaxIncome: 90_000 }).cost;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(90_000);
  });
});
