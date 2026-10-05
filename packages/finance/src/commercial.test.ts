/**
 * Ticket 0606 — the plain rules of letting to businesses, and the lender that
 * lends on them.
 */

import { describe, expect, it } from 'vitest';
import {
  APPLICANTS_BY_MARKET,
  COMMERCIAL_RENT_COUNTED,
  FAILURE_BY_MARKET,
  GAP_BY_MARKET,
  MAX_GAP,
  commercialApplicantCount,
  commercialReliability,
  commercialTraits,
  commercialUnitYear,
  firstYearShare,
  leaseLengthOf,
  leaveAtLeaseEnd,
  RENT_COUNTED,
  mortgageFor,
  type HomeBuyer,
  type MarketState,
  type Tenant,
} from './index';

const STATES: readonly MarketState[] = [
  'severeRecession',
  'recession',
  'slowdown',
  'normal',
  'growth',
  'strongExpansion',
];

const tenant = (over: Partial<Tenant> = {}): Tenant => ({
  id: 't',
  name: 'Corner Books',
  since: 2030,
  income: 400_000,
  credit: 'good',
  work: 'steady',
  household: 4,
  evictions: 0,
  trade: 'biz.specialty',
  rent: 40_000,
  leaseEnds: 2034,
  ...over,
});

const year = (over: Partial<Parameters<typeof commercialUnitYear>[0]> = {}) =>
  commercialUnitYear({
    tenant: tenant(),
    year: 2032,
    rentYear: 44_000,
    level: 1,
    firstShare: 0.8,
    market: 'normal',
    payRoll: 0.1,
    renewRoll: 0.9,
    ...over,
  });

describe('0606 — the economy’s tables', () => {
  it('only ever move the right way, state by state', () => {
    for (let i = 1; i < STATES.length; i += 1) {
      const worse = STATES[i - 1]!;
      const better = STATES[i]!;
      expect(FAILURE_BY_MARKET[worse]).toBeGreaterThan(FAILURE_BY_MARKET[better]);
      expect(GAP_BY_MARKET[worse]).toBeGreaterThan(GAP_BY_MARKET[better]);
      expect(APPLICANTS_BY_MARKET[worse]).toBeLessThan(APPLICANTS_BY_MARKET[better]);
    }
    expect(FAILURE_BY_MARKET.normal).toBe(1);
    expect(GAP_BY_MARKET.normal).toBe(1);
    expect(APPLICANTS_BY_MARKET.normal).toBe(1);
  });

  it('answers a listing with at least one business unless the rent is out of reach', () => {
    for (const state of STATES)
      expect(commercialApplicantCount(1, state)).toBeGreaterThanOrEqual(1);
    expect(commercialApplicantCount(1.3, 'strongExpansion')).toBe(0);
    // One applicant at a high rent is still one in a crash, not none.
    expect(commercialApplicantCount(1.2, 'severeRecession')).toBe(1);
    expect(commercialApplicantCount(0.8, 'strongExpansion')).toBeGreaterThan(
      commercialApplicantCount(0.8, 'severeRecession'),
    );
  });
});

describe('0606 — leases', () => {
  it('are drawn evenly from the kind’s own range, ends included', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i += 1) seen.add(leaseLengthOf([3, 7], i / 100));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
    expect(leaseLengthOf([1, 1], 0.99)).toBe(1);
    expect(leaseLengthOf([3, 5], 0.999999)).toBe(5);
  });

  it('end in a departure at one and a half times the rent table’s yearly chance', () => {
    expect(leaveAtLeaseEnd(1)).toBeCloseTo(0.42, 6);
    expect(leaveAtLeaseEnd(0.8)).toBeCloseTo(0.225, 6);
  });

  it('end in a departure more often when the rent is set higher', () => {
    expect(leaveAtLeaseEnd(1.2)).toBeGreaterThan(leaveAtLeaseEnd(1));
    expect(leaveAtLeaseEnd(1)).toBeGreaterThan(leaveAtLeaseEnd(0.8));
    expect(leaveAtLeaseEnd(1.3)).toBeLessThanOrEqual(0.95);
  });

  it('pay less of their first year in a worse economy, and never less than nothing or more than all', () => {
    let last = 0;
    for (const state of STATES) {
      const share = firstYearShare(0.12, 4, state);
      expect(share).toBeGreaterThanOrEqual(1 - MAX_GAP);
      expect(share).toBeLessThanOrEqual(1);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
    // At the clamp the worst two states can tie (a year of no rent is as bad as it gets); the rest cannot.
    expect(firstYearShare(0.12, 4, 'normal')).toBeLessThan(
      firstYearShare(0.12, 4, 'strongExpansion'),
    );
    expect(firstYearShare(0.05, 4, 'severeRecession')).toBeLessThan(
      firstYearShare(0.05, 4, 'normal'),
    );
    expect(firstYearShare(0.2, 4, 'normal')).toBeLessThan(firstYearShare(0.05, 4, 'normal'));
    expect(firstYearShare(0, 4, 'normal')).toBe(1);
  });

  it('are sized so that the share of a unit’s life spent empty is the kind’s vacancy', () => {
    /*
      A unit turns over at leave/term + failure a year and each turn costs `gap`
      of a year; the share empty is gap·r / (1 + gap·r). With r = 0.42/4 + 0.04
      and gap = 1 - firstYearShare, that comes back to the vacancy it was sized from.
    */
    const r = 0.42 / 4 + 0.04;
    for (const [vacancy, term] of [
      [0.05, 4],
      [0.08, 4],
    ] as const) {
      const gap = 1 - firstYearShare(vacancy, term, 'normal');
      const r4 = 0.42 / term + 0.04;
      expect((gap * r4) / (1 + gap * r4)).toBeCloseTo(vacancy, 2);
    }
    expect(1 - firstYearShare(0.05, 4, 'normal')).toBeCloseTo(0.05 / 0.95 / r, 6);
    // A longer term turns the unit over less often, so each turn can cost more for the same vacancy.
    expect(firstYearShare(0.05, 8, 'normal')).toBeLessThan(firstYearShare(0.05, 2, 'normal'));
  });
});

describe('0606 — businesses as tenants', () => {
  it('earn six to fourteen times the rent, and a young one is the riskier', () => {
    const low = commercialTraits(40_000, [0, 0, 0, 0, 0]);
    const high = commercialTraits(40_000, [0.999, 0, 0, 0, 0]);
    expect(low.income).toBe(240_000);
    expect(high.income).toBeGreaterThan(550_000);
    expect(high.income).toBeLessThanOrEqual(560_000);
    expect(commercialTraits(40_000, [0.5, 0.1, 0.1, 0.5, 0.5]).work).toBe('steady');
    expect(commercialTraits(40_000, [0.5, 0.1, 0.9, 0.5, 0.5]).work).toBe('new');
    const sound = commercialTraits(40_000, [0.5, 0.1, 0.1, 0.5, 0.5]);
    // Poor credit, a young business and a past default, in a crash: the chance it pays bottoms out.
    const worst = { ...sound, credit: 'poor' as const, work: 'new' as const, evictions: 2 };
    expect(commercialReliability(worst, 40_000, 'severeRecession')).toBe(0.4);
    // A poor-credit applicant sometimes comes with a past default; a good one never does.
    const defaults = [0, 0.1, 0.3].map(
      (u5) => commercialTraits(40_000, [0.5, 0.95, 0.1, 0.5, u5]).evictions,
    );
    expect(defaults).toEqual([1, 1, 0]);
    expect(commercialTraits(40_000, [0.5, 0.1, 0.1, 0.5, 0]).evictions).toBe(0);
    const young = { ...sound, work: 'new' as const };
    expect(commercialReliability(young, 40_000, 'normal')).toBeLessThan(
      commercialReliability(sound, 40_000, 'normal'),
    );
  });

  it('fail more in a recession than in a boom, the same business', () => {
    const t = tenant({ credit: 'fair' });
    const chances = STATES.map((s) => commercialReliability(t, 40_000, s));
    for (let i = 1; i < chances.length; i += 1)
      expect(chances[i]!).toBeGreaterThan(chances[i - 1]!);
    expect(chances[0]!).toBeGreaterThanOrEqual(0.4);
    expect(chances[chances.length - 1]!).toBeLessThanOrEqual(0.995);
  });
});

describe('0606 — a unit’s year', () => {
  it('collects nothing from an empty unit', () => {
    expect(year({ tenant: null })).toEqual({ outcome: 'empty', collected: 0 });
  });

  it('pays the lease’s rent, not today’s, while the lease runs', () => {
    expect(year()).toEqual({ outcome: 'stayed', collected: 40_000 });
  });

  it('pays a part of the first year of a new lease', () => {
    expect(year({ tenant: tenant({ since: 2032 }) })).toEqual({
      outcome: 'stayed',
      collected: 32_000,
    });
    expect(year({ tenant: tenant({ since: 2031 }) }).collected).toBe(40_000);
  });

  it('renews or leaves only when the lease is up', () => {
    const ending = tenant({ leaseEnds: 2032 });
    expect(year({ tenant: ending, renewRoll: 0.99 }).outcome).toBe('renewed');
    expect(year({ tenant: ending, renewRoll: 0.01 }).outcome).toBe('left');
    expect(year({ tenant: ending, renewRoll: 0.01 }).collected).toBe(40_000);
    // Mid-lease the roll does nothing.
    expect(year({ renewRoll: 0.01 }).outcome).toBe('stayed');
    // Past its end counts as up.
    expect(year({ tenant: tenant({ leaseEnds: 2030 }), renewRoll: 0.01 }).outcome).toBe('left');
  });

  it('collects half the year from a business that fails, whatever the lease says', () => {
    expect(year({ payRoll: 0.999 })).toEqual({ outcome: 'failed', collected: 20_000 });
    expect(year({ payRoll: 0.999, tenant: tenant({ leaseEnds: 2032 }) }).outcome).toBe('failed');
  });

  it('fails a marginal business in a recession that a boom would have kept', () => {
    const marginal = tenant({ credit: 'fair' });
    const chance = (s: MarketState) => commercialReliability(marginal, 40_000, s);
    const roll = (chance('recession') + chance('growth')) / 2;
    expect(year({ tenant: marginal, payRoll: roll, market: 'recession' }).outcome).toBe('failed');
    expect(year({ tenant: marginal, payRoll: roll, market: 'growth' }).outcome).toBe('stayed');
  });
});

describe('0606 — the commercial lender', () => {
  const buyer: HomeBuyer = {
    age: 40,
    standing: 'good',
    income: 300_000,
    cash: 2_000_000,
    otherPayments: 0,
    mortgaged: 0,
    mortgages: 0,
  };

  it('lends on a commercial building at its own product, and counts less of the rent', () => {
    const offer = mortgageFor(2_000_000, buyer, 24_000, 'commercial', 180_000);
    expect(offer.approved).toBe(true);
    expect(offer.product?.id).toBe('mortgage.commercial');
    expect(offer.down).toBeGreaterThanOrEqual(600_000);
    expect(COMMERCIAL_RENT_COUNTED).toBeLessThan(0.75);
  });

  it('never lends a house loan on a warehouse, or a warehouse loan on a house', () => {
    for (const purpose of ['home', 'rental'] as const) {
      const offer = mortgageFor(400_000, buyer, 6_000, purpose, 40_000);
      if (offer.approved) expect(offer.product?.commercial).toBeFalsy();
    }
    const commercial = mortgageFor(400_000, buyer, 6_000, 'commercial', 40_000);
    expect(commercial.approved).toBe(true);
    expect(commercial.product?.commercial).toBe(true);
  });

  it('counts 70 cents on the dollar of the rent, no more', () => {
    // The income a buyer needs, found by search, falls by what the lender counts of the rent.
    const need = (rent: number) => {
      let low = 0;
      let high = 5_000_000;
      while (high - low > 50) {
        const mid = (low + high) / 2;
        const ok = mortgageFor(
          3_000_000,
          { ...buyer, income: mid, cash: 3_000_000 },
          30_000,
          'commercial',
          rent,
        ).approved;
        if (ok) high = mid;
        else low = mid;
      }
      return high;
    };
    const saved = need(0) - need(200_000);
    expect(saved).toBeGreaterThan(200_000 * COMMERCIAL_RENT_COUNTED * 0.97);
    expect(saved).toBeLessThan(200_000 * COMMERCIAL_RENT_COUNTED * 1.03);
    expect(COMMERCIAL_RENT_COUNTED).toBeLessThan(RENT_COUNTED);
  });

  it('keeps the house loans for houses and the investment loan for rentals', () => {
    const rich = { ...buyer, income: 900_000, cash: 3_000_000 };
    const home = mortgageFor(500_000, rich, 6_000, 'home', 0);
    const rental = mortgageFor(500_000, rich, 6_000, 'rental', 40_000);
    expect(home.approved && rental.approved).toBe(true);
    expect(home.product?.investment ?? false).toBe(false);
    expect(rental.product?.investment).toBe(true);
    expect(
      mortgageFor(500_000, rich, 6_000, 'commercial', 40_000).product?.investment ?? false,
    ).toBe(false);
  });

  it('refuses a buyer with too little to put down, and says why', () => {
    const thin = { ...buyer, cash: 100_000 };
    const offer = mortgageFor(2_000_000, thin, 24_000, 'commercial', 180_000);
    expect(offer.approved).toBe(false);
    expect(offer.because).toBeDefined();
  });
});
