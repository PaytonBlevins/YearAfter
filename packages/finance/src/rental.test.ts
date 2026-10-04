/**
 * Ticket 0503 — letting property, as plain rules.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  AGENT_SHARE,
  PAID_BEFORE_EVICTION,
  RENT_LEVELS,
  applicantTraits,
  bestApplicant,
  emptyLetting,
  goingRentOf,
  reliabilityOf,
  rentLevelOf,
  rentalEconomics,
  stepRent,
  unitYear,
  type Tenant,
} from './rental';
import { MAX_MORTGAGES, mortgageFor, type HomeBuyer } from './property';

const tenant = (over: Partial<Tenant> = {}): Tenant => ({
  id: 't',
  name: 'Ana Reyes',
  since: 2030,
  income: 70_000,
  credit: 'good',
  work: 'steady',
  household: 2,
  evictions: 0,
  ...over,
});

describe('0503 — the rent', () => {
  it('yields less where houses are dear', () => {
    const cheap = goingRentOf(dollars(400_000), 0.078, 0.9, 1);
    const dear = goingRentOf(dollars(400_000), 0.078, 1.4, 1);
    expect(cheap / 400_000).toBeGreaterThan(0.08);
    expect(dear / 400_000).toBeLessThan(0.065);
    // Per unit: a duplex's rent is split two ways.
    expect(goingRentOf(dollars(400_000), 0.078, 1, 2)).toBeCloseTo((400_000 * 0.078) / 2, -2);
  });

  it('steps through six settings and stops at either end', () => {
    expect(RENT_LEVELS.map((level) => level.level)).toEqual([0.8, 0.9, 1, 1.1, 1.2, 1.3]);
    expect(stepRent(1, 1)).toBe(1.1);
    expect(stepRent(1.3, 1)).toBe(1.3);
    expect(stepRent(0.8, -1)).toBe(0.8);
    expect(rentLevelOf(1.04).level).toBe(1);
  });

  it('draws fewer applicants and keeps tenants less the higher it goes', () => {
    for (let i = 1; i < RENT_LEVELS.length; i += 1) {
      const lower = RENT_LEVELS[i - 1]!;
      const higher = RENT_LEVELS[i]!;
      expect(higher.applicants).toBeLessThan(lower.applicants);
      expect(higher.leave).toBeGreaterThan(lower.leave);
      expect(higher.gap).toBeGreaterThan(lower.gap);
    }
    // Nobody answers at the top of the table.
    expect(RENT_LEVELS[RENT_LEVELS.length - 1]!.applicants).toBe(0);
  });
});

describe('0503 — tenants', () => {
  it('shows spec 157’s indicators and nothing that reads as a score', () => {
    const traits = applicantTraits(20_000, [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(Object.keys(traits).sort()).toEqual([
      'credit',
      'evictions',
      'household',
      'income',
      'work',
    ]);
  });

  it('draws incomes a rent could plausibly come out of', () => {
    for (const u of [0, 0.5, 0.999]) {
      const { income } = applicantTraits(20_000, [u, 0.1, 0.1, 0.1, 0.9]);
      expect(20_000 / income).toBeGreaterThan(0.15);
      expect(20_000 / income).toBeLessThan(0.45);
    }
  });

  it('gives evictions to the people whose credit already says so', () => {
    const share = (credit: number) => {
      let evicted = 0;
      for (let i = 0; i < 1000; i += 1) {
        if (applicantTraits(20_000, [0.5, credit, 0.5, 0.5, i / 1000]).evictions > 0) evicted += 1;
      }
      return evicted / 1000;
    };
    expect(share(0.95)).toBeGreaterThan(share(0.7));
    expect(share(0.7)).toBeGreaterThan(share(0.1));
  });

  it('makes the indicators mean something', () => {
    const rent = 20_000;
    expect(reliabilityOf(tenant(), rent)).toBeGreaterThan(
      reliabilityOf(tenant({ credit: 'poor' }), rent),
    );
    expect(reliabilityOf(tenant(), rent)).toBeGreaterThan(
      reliabilityOf(tenant({ work: 'between' }), rent),
    );
    expect(reliabilityOf(tenant(), rent)).toBeGreaterThan(
      reliabilityOf(tenant({ evictions: 1 }), rent),
    );
    expect(reliabilityOf(tenant(), rent)).toBeGreaterThan(
      reliabilityOf(tenant({ income: 35_000 }), rent),
    );
    const pick = bestApplicant([tenant({ id: 'a', credit: 'poor' }), tenant({ id: 'b' })], rent);
    expect(pick?.id).toBe('b');
  });
});

describe('0503 — a unit’s year', () => {
  const base = { year: 2031, rentYear: 24_000, level: 1, payRoll: 0, leaveRoll: 0.99 };

  it('collects the year from a tenant who stays', () => {
    const year = unitYear({ ...base, tenant: tenant({ since: 2030 }) });
    expect(year).toEqual({ outcome: 'stayed', collected: 24_000 });
  });

  it('collects less in the year a tenant moves in', () => {
    const year = unitYear({ ...base, tenant: tenant({ since: 2031 }) });
    expect(year.collected).toBe(Math.round(24_000 * (1 - rentLevelOf(1).gap)));
  });

  it('evicts a tenant who stops paying, having collected half', () => {
    const year = unitYear({ ...base, tenant: tenant({ since: 2030 }), payRoll: 0.999 });
    expect(year).toEqual({ outcome: 'evicted', collected: 24_000 * PAID_BEFORE_EVICTION });
  });

  it('lets a tenant leave at the end of a year they paid for', () => {
    const year = unitYear({ ...base, tenant: tenant({ since: 2030 }), leaveRoll: 0 });
    expect(year).toEqual({ outcome: 'left', collected: 24_000 });
  });

  it('collects nothing from an empty unit', () => {
    expect(unitYear({ ...base, tenant: null })).toEqual({ outcome: 'empty', collected: 0 });
  });
});

describe('0503 — the rental flow’s numbers', () => {
  it('adds up what a year would leave', () => {
    const numbers = rentalEconomics({
      units: 2,
      let: 2,
      goingRent: 18_000,
      level: 1,
      managed: true,
      mortgageYear: 20_000,
      upkeepYear: 9_000,
    });
    expect(numbers.rentPerUnitMonth).toBe(1_500);
    expect(numbers.fullYear).toBe(36_000);
    expect(numbers.agentYear).toBe(Math.round(36_000 * AGENT_SHARE));
    expect(numbers.profitYear).toBe(36_000 - numbers.agentYear - 20_000 - 9_000);
    expect(numbers.mortgageMonth).toBe(Math.round(20_000 / 12));
  });

  it('starts a new building empty, at the going rate, without an agent', () => {
    expect(emptyLetting(5)).toEqual({
      level: 1,
      managed: false,
      tenants: [null, null, null, null, null],
    });
  });
});

describe('0503 — an investment mortgage', () => {
  const buyer = (over: Partial<HomeBuyer> = {}): HomeBuyer => ({
    age: 45,
    standing: 'good',
    income: 120_000,
    cash: 200_000,
    otherPayments: 0,
    mortgaged: 1,
    mortgages: 1,
    ...over,
  });

  it('lends on a rental with a quarter down, even with a home mortgage already', () => {
    const offer = mortgageFor(500_000, buyer(), 12_000, 'rental', 40_000);
    expect(offer.approved).toBe(true);
    expect(offer.product?.id).toBe('mortgage.investment');
    expect(offer.down).toBeGreaterThanOrEqual(125_000);
  });

  it('never gives the investment product to somebody buying a home', () => {
    const offer = mortgageFor(300_000, buyer({ mortgaged: 0, mortgages: 0 }), 6_000, 'home');
    expect(offer.product?.investment ?? false).toBe(false);
  });

  it('counts three quarters of the rent toward carrying it', () => {
    const tight = buyer({ income: 70_000 });
    expect(mortgageFor(500_000, tight, 12_000, 'rental', 0).approved).toBe(false);
    expect(mortgageFor(500_000, tight, 12_000, 'rental', 45_000).approved).toBe(true);
  });

  it('stops at a sensible number of mortgaged properties', () => {
    expect(
      mortgageFor(500_000, buyer({ mortgages: MAX_MORTGAGES }), 12_000, 'rental', 40_000).because,
    ).toBe('tooManyMortgages');
  });
});
