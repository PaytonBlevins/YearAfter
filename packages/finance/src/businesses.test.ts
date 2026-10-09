/**
 * Ticket 0601 acceptance tests — the business engine (finance side).
 *
 * Calibrated against the BLS survival table and benchmark owner pay, not
 * against what felt fun; the numbers these tests pin are the ones the
 * tuning probes settled on, with the ranges wide enough that a retune inside
 * the same intent does not break them and a change of intent does.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import {
  BRANCH_COST_SHARE,
  BRANCH_OVERHEAD_SHARE,
  EXPAND_AFTER_YEARS,
  EXPAND_REFUSAL_LABELS,
  LOCATION_SHARE,
  MAX_BUSINESSES,
  MAX_LOCATIONS,
  OPEN_REFUSAL_LABELS,
  PAYROLLS,
  PRICE_STEPS,
  SUPPLIER_GRADES,
  assetValueFor,
  autoStaffFor,
  branchCostFor,
  branchWindDownOf,
  businessAppraisalFor,
  businessSaleOf,
  businessValueFor,
  businessYear,
  businessesValue,
  clampPrice,
  expansionRefusal,
  footprintFor,
  goingConcernFor,
  locationsOf,
  luckFrom,
  maturityFor,
  newBusiness,
  reputationWord,
  reachOf,
  reserveFor,
  serviceNoticedIn,
  settleYear,
  staffCeilingFor,
  visibleTo,
  windDownOf,
  withBranch,
  withProfit,
  withoutBranch,
  type OwnedBusiness,
} from './businesses';

const NORMAL = { year: 2012, market: 'normal' as const, shock: 0, stat: 50, hands: 1 };

/** A business that has had time to staff itself and find its customers. */
const mature = (
  typeId: string,
): { business: OwnedBusiness; type: (typeof BUSINESS_TYPES)[number] } => {
  const type = findBusinessType(typeId)!;
  return {
    type,
    business: { ...newBusiness(type, 'b:1', 'Test', 2000, 1), staff: type.staff, reputation: 50 },
  };
};

describe('the catalog', () => {
  it('has thirty-one distinct, well-formed types', () => {
    expect(BUSINESS_TYPES).toHaveLength(31);
    expect(new Set(BUSINESS_TYPES.map((type) => type.id)).size).toBe(31);
    for (const type of BUSINESS_TYPES) {
      expect(type.skills).toHaveLength(2);
      expect(type.names.length).toBeGreaterThanOrEqual(6);
      expect(type.staffMin).toBeLessThanOrEqual(type.staff);
      expect(type.gate).toBe(Math.round(type.startup * 0.6));
    }
  });

  it('is reachable in steps: the cheapest is within most lives, the dearest within none', () => {
    const startups = BUSINESS_TYPES.map((type) => type.startup).sort((a, b) => a - b);
    expect(startups[0]).toBeLessThanOrEqual(25_000);
    expect(startups[startups.length - 1]).toBeGreaterThanOrEqual(2_000_000);
    expect(visibleTo(findBusinessType('biz.hotel')!, 150_000)).toBe(false);
    expect(visibleTo(findBusinessType('biz.cleaning')!, 25_000)).toBe(true);
  });
});

describe('a year of trading', () => {
  it('pays a mature, staffed business of every type its owner something, at neutral luck', () => {
    for (const type of BUSINESS_TYPES) {
      // Staffed to match what the customers want, as the manager does: a
      // studio with room for a hit is overstaffed for an ordinary year.
      let { business } = mature(type.id);
      for (let round = 0; round < 8; round += 1) {
        business = {
          ...business,
          staff: autoStaffFor(type, business.staff, businessYear(business, type, NORMAL), 1, 1),
        };
      }
      const year = businessYear(business, type, NORMAL);
      expect(year.profit, type.id).toBeGreaterThan(0);
      expect(year.profit, type.id).toBeLessThan(year.revenue * 0.5);
      expect(year.costs).toBe(year.cogs + year.labor + year.overhead);
    }
  });

  it('puts the best price near the going rate for every type, not at a wall', () => {
    for (const type of BUSINESS_TYPES) {
      // Staffed for the ordinary year first, as the manager does, then the
      // price moves: a studio with room for a hit is overstaffed otherwise.
      let { business } = mature(type.id);
      for (let round = 0; round < 8; round += 1) {
        business = {
          ...business,
          staff: autoStaffFor(type, business.staff, businessYear(business, type, NORMAL), 1, 1),
        };
      }
      const profitAt = (price: number): number => {
        let priced = { ...business, price };
        for (let round = 0; round < 8; round += 1) {
          priced = {
            ...priced,
            staff: autoStaffFor(type, priced.staff, businessYear(priced, type, NORMAL), 1, 1),
          };
        }
        return businessYear(priced, type, NORMAL).profit;
      };
      // P13's approved pricing exclusion: old saved prices cannot change a brokerage's year.
      if (type.id === 'biz.realestate') {
        const baseline = businessYear({ ...business, price: 100 }, type, NORMAL);
        for (const price of PRICE_STEPS)
          expect(businessYear({ ...business, price }, type, NORMAL)).toEqual(baseline);
        continue;
      }
      const best = PRICE_STEPS.reduce((top, price) =>
        profitAt(price) > profitAt(top) ? price : top,
      );
      expect(best, type.id).toBeGreaterThanOrEqual(85);
      expect(best, type.id).toBeLessThanOrEqual(135);
      // And moving the slider is worth something, not everything: the best
      // price beats the going one by under fifteen points of revenue.
      const revenue = businessYear(business, type, NORMAL).revenue;
      expect((profitAt(best) - profitAt(100)) / revenue, type.id).toBeLessThan(0.15);
    }
  });

  it('lets no single dial win across the board, once the manager has staffed to match', () => {
    /** The headcount the default manager settles on for this setup. */
    const settled = (
      business: OwnedBusiness,
      type: (typeof BUSINESS_TYPES)[number],
    ): OwnedBusiness => {
      let next = business;
      for (let round = 0; round < 8; round += 1) {
        const year = businessYear(next, type, NORMAL);
        next = { ...next, staff: autoStaffFor(type, next.staff, year, 1, NORMAL.hands) };
      }
      return next;
    };
    /**
     * How many points of revenue this setup earns over the default, per type:
     * a difference in margin, which means the same for a café and a resort.
     */
    const points = (change: Partial<OwnedBusiness>, needsSupplier = false): number[] => {
      const out: number[] = [];
      for (const type of BUSINESS_TYPES) {
        if (needsSupplier && !type.supplier) continue;
        const { business } = mature(type.id);
        const base = businessYear(settled(business, type), type, NORMAL);
        const tried = businessYear(settled({ ...business, ...change }, type), type, NORMAL);
        out.push((tried.profit - base.profit) / base.revenue);
      }
      return out;
    };
    const mean = (values: readonly number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    for (const payroll of PAYROLLS) {
      const gains = points({ payroll });
      expect(mean(gains), payroll).toBeLessThan(0.05);
      expect(Math.max(...gains), payroll).toBeLessThan(0.16);
    }
    for (const supplier of SUPPLIER_GRADES) {
      const gains = points({ supplier }, true);
      expect(mean(gains), supplier).toBeLessThan(0.05);
      expect(Math.max(...gains), supplier).toBeLessThan(0.16);
    }
    // And the top of the payroll ladder is not free money: it costs the owner.
    expect(mean(points({ payroll: 'bigBucks' }))).toBeLessThan(0);
  });

  it('is hurt by a recession in proportion to how cyclical the trade is', () => {
    const cyclical = BUSINESS_TYPES.reduce((a, b) => (b.cyclical > a.cyclical ? b : a));
    const steady = BUSINESS_TYPES.reduce((a, b) => (b.cyclical < a.cyclical ? b : a));
    const drop = (type: typeof cyclical) => {
      const { business } = mature(type.id);
      const normal = businessYear(business, type, NORMAL).revenue;
      const bad = businessYear(business, type, { ...NORMAL, market: 'severeRecession' }).revenue;
      return 1 - bad / normal;
    };
    expect(drop(cyclical)).toBeGreaterThan(drop(steady));
    expect(drop(steady)).toBeGreaterThanOrEqual(0);
  });

  it('serves no more than the staff can: a short-staffed shop turns customers away', () => {
    const { business, type } = mature('biz.cafe');
    const thin = businessYear({ ...business, staff: type.staffMin }, type, NORMAL);
    const full = businessYear(business, type, NORMAL);
    expect(thin.turnedAway).toBeGreaterThan(full.turnedAway);
    expect(thin.revenue).toBeLessThan(full.revenue);
  });

  it('is shakier when young than when established', () => {
    // The same bad draw hurts a business in its second year more, in
    // proportion to what it normally sells, than one with regulars.
    const { business, type } = mature('biz.restaurant');
    const swing = (year: number): number => {
      // Demand, not revenue: a full house hides how far the year swung.
      const bad = businessYear(business, type, { ...NORMAL, year, shock: -2 }).demand;
      const good = businessYear(business, type, { ...NORMAL, year, shock: 2 }).demand;
      const middle = businessYear(business, type, { ...NORMAL, year, shock: 0 }).demand;
      return (good - bad) / middle;
    };
    // Age 1 (year 2002) against age 11 (year 2012): same shocks, different swing.
    expect(swing(2002)).toBeGreaterThan(swing(2012) * 1.3);
    expect(businessYear(business, type, { ...NORMAL, year: 2002 }).revenue).toBeLessThan(
      businessYear(business, type, NORMAL).revenue,
    );
  });

  it('is deterministic', () => {
    const { business, type } = mature('biz.salon');
    expect(businessYear(business, type, NORMAL)).toEqual(businessYear(business, type, NORMAL));
  });
});

describe('where the money goes', () => {
  it('keeps three months of costs and pays the rest out', () => {
    const reserve = reserveFor(120_000);
    expect(reserve).toBe(30_000);
    const flush = settleYear(10_000, 90_000, 120_000);
    expect(flush.cash).toBe(reserve);
    expect(flush.drawn).toBe(100_000 - reserve);
    expect(flush.needed).toBe(0);
  });

  it('draws nothing while the till is below the reserve', () => {
    const thin = settleYear(0, 5_000, 120_000);
    expect(thin.drawn).toBe(0);
    expect(thin.cash).toBe(5_000);
  });

  it('asks the owner to cover a hole, and half a reserve besides', () => {
    const hole = settleYear(10_000, -40_000, 120_000);
    expect(hole.needed).toBe(30_000 + 15_000);
    expect(hole.drawn).toBe(0);
  });

  it('never reserves less than five thousand', () => {
    expect(reserveFor(1_000)).toBe(5_000);
  });
});

describe('worth, sale and wind-down', () => {
  it('is worth at least its fittings even when it earns nothing', () => {
    const { business, type } = mature('biz.cafe');
    const idle = { ...business, profits: [0, 0, 0] };
    const worth = goingConcernFor(idle, type, 2012);
    expect(worth).toBeGreaterThan(0);
    expect(worth).toBeLessThan(type.startup);
  });

  it('is worth more the better it has earned and the better its name', () => {
    const { business, type } = mature('biz.accounting');
    const poor = goingConcernFor({ ...business, profits: [10_000, 10_000, 10_000] }, type, 2012);
    const rich = goingConcernFor({ ...business, profits: [90_000, 90_000, 90_000] }, type, 2012);
    const known = goingConcernFor(
      { ...business, profits: [90_000, 90_000, 90_000], reputation: 90 },
      type,
      2012,
    );
    expect(rich).toBeGreaterThan(poor);
    expect(known).toBeGreaterThan(rich);
  });

  it('adds the till to what the owner values it at', () => {
    const { business, type } = mature('biz.salon');
    const empty = { ...business, cash: dollars(0) };
    const withCash = { ...business, cash: dollars(40_000) };
    expect(businessValueFor(withCash, type, 2012) - businessValueFor(empty, type, 2012)).toBe(
      40_000,
    );
  });

  it('sells below its going-concern value, less the broker, with the till handed over', () => {
    const { business, type } = mature('biz.hvac');
    const owned = { ...business, profits: [80_000, 80_000, 80_000], cash: dollars(25_000) };
    const sale = businessSaleOf(owned, type, 2012, 0);
    expect(sale.price).toBeLessThan(goingConcernFor(owned, type, 2012));
    expect(sale.fee).toBeGreaterThan(0);
    expect(sale.cash).toBe(25_000);
    expect(sale.proceeds).toBe(sale.price - sale.fee + 25_000);
    // A lucky buyer pays more than an unlucky one.
    expect(businessSaleOf(owned, type, 2012, 1.5).price).toBeGreaterThan(
      businessSaleOf(owned, type, 2012, -1.5).price,
    );
  });

  it('gives a valuation as a band around the value', () => {
    const band = businessAppraisalFor(500_000, 0.5);
    expect(band.low).toBeLessThan(500_000);
    expect(band.high).toBeGreaterThan(500_000);
  });

  it('winds down for a fraction of its fittings plus the till, and less than a sale', () => {
    const { business, type } = mature('biz.cafe');
    const owned = { ...business, profits: [50_000, 50_000, 50_000], cash: dollars(10_000) };
    const wound = windDownOf(owned, type, 2012);
    expect(wound).toBeGreaterThanOrEqual(10_000);
    expect(wound).toBeLessThan(businessSaleOf(owned, type, 2012, 0).proceeds);
  });

  it('totals what a list of businesses is worth', () => {
    const a = mature('biz.cafe').business;
    const b = mature('biz.salon').business;
    expect(businessesValue([a, b], findBusinessType, 2012)).toBe(
      dollars(
        businessValueFor(a, findBusinessType(a.typeId)!, 2012) +
          businessValueFor(b, findBusinessType(b.typeId)!, 2012),
      ),
    );
    expect(businessesValue([], findBusinessType, 2012)).toBe(dollars(0));
  });
});

describe('staffing and the small pieces', () => {
  it('hires a few at a time when customers are turned away and never past the ceiling', () => {
    const { type } = mature('biz.landscaping');
    const hungry = { demand: type.revenue * 10 };
    const next = autoStaffFor(type, type.staffMin, hungry, 1, 1);
    expect(next).toBeGreaterThan(type.staffMin);
    expect(next).toBeLessThanOrEqual(type.staffMin + 3);
    expect(autoStaffFor(type, staffCeilingFor(type), hungry, 1, 1)).toBe(staffCeilingFor(type));
  });

  it('lets people go when the work dries up, but never below what the doors need', () => {
    const { type } = mature('biz.landscaping');
    const quiet = { demand: 0 };
    expect(autoStaffFor(type, type.staff, quiet, 1, 1)).toBeLessThan(type.staff);
    expect(autoStaffFor(type, type.staffMin, quiet, 1, 1)).toBe(type.staffMin);
  });

  it('keeps the price on the slider', () => {
    expect(clampPrice(10)).toBe(70);
    expect(clampPrice(500)).toBe(140);
    expect(clampPrice(103)).toBe(105);
  });

  it('describes a name in words', () => {
    expect(reputationWord(90)).toBe('Beloved');
    expect(reputationWord(70)).toBe('Well liked');
    expect(reputationWord(50)).toBe('Known in town');
    expect(reputationWord(30)).toBe('Little known');
    expect(reputationWord(5)).toBe('Not good');
  });

  it('keeps luck inside its band and keeps three years of profit', () => {
    for (const z of [-5, -1, 0, 1, 5]) {
      expect(luckFrom(z)).toBeGreaterThanOrEqual(0.55);
      expect(luckFrom(z)).toBeLessThanOrEqual(1.45);
    }
    expect(withProfit([1, 2, 3], 4)).toEqual([2, 3, 4]);
  });

  it('says why you cannot open one', () => {
    expect(Object.keys(OPEN_REFUSAL_LABELS).sort()).toEqual(
      ['cannot-afford', 'no-such-type', 'too-many', 'too-young'].sort(),
    );
    expect(MAX_BUSINESSES).toBe(3);
  });
});

describe('Ticket 0602 — the rest of the catalog', () => {
  it('has types in every sector spec 396 names, and none it removed', () => {
    const ids = BUSINESS_TYPES.map((type) => type.id);
    for (const wanted of [
      'law',
      'marketing',
      'realestate',
      'jewelry',
      'electronics',
      'furniture',
      'specialty',
      'resort',
      'electrical',
      'plumbing',
      'roofing',
      'gaming',
      'media',
      'production',
      'apparelmfg',
      'electronicsmfg',
      'specialtymfg',
      'trucking',
      'vehiclerental',
    ]) {
      expect(ids, wanted).toContain(`biz.${wanted}`);
    }
    // Spec 396 removed these. Nothing in the catalog may be named for one.
    const names = BUSINESS_TYPES.map((type) => type.name.toLowerCase()).join('|');
    for (const gone of [
      'consulting',
      'staffing',
      'wealth management',
      'pet services',
      'childcare',
      'catering',
      'general contractor',
      'app studio',
      'courier',
      'logistics',
      'event company',
    ]) {
      expect(names, gone).not.toContain(gone);
    }
  });

  it('pays the owner something sensible at maturity, in every type, in every sector', () => {
    for (const type of BUSINESS_TYPES) {
      const { business } = mature(type.id);
      const settled = (() => {
        let next = business;
        for (let round = 0; round < 8; round += 1) {
          const year = businessYear(next, type, NORMAL);
          next = { ...next, staff: autoStaffFor(type, next.staff, year, 1, 1) };
        }
        return next;
      })();
      const year = businessYear(settled, type, NORMAL);
      expect(year.profit / year.revenue, type.id).toBeGreaterThan(0.02);
      expect(year.profit / year.revenue, type.id).toBeLessThan(0.4);
    }
  });

  it('lets a game sell past its normal year with the same people, and a cleaning crew not', () => {
    const gaming = findBusinessType('biz.gaming')!;
    const cleaning = findBusinessType('biz.cleaning')!;
    expect(gaming.headroom).toBeGreaterThan(1.5);
    expect(cleaning.headroom).toBe(1);
    const a = mature('biz.gaming');
    const hit = businessYear(a.business, a.type, { ...NORMAL, shock: 2 });
    expect(hit.demand).toBeGreaterThan(a.type.revenue * 1.5);
    expect(hit.revenue).toBeGreaterThan(a.type.revenue * 1.3);
  });

  it('lets the people matter most where the business is people', () => {
    expect(serviceNoticedIn(findBusinessType('biz.law')!)).toBe(1);
    expect(serviceNoticedIn(findBusinessType('biz.vehiclerental')!)).toBeLessThan(0.7);
  });
});

describe('Ticket 0602 — locations', () => {
  const owned = (typeId: string, branches: readonly number[] = []): OwnedBusiness => ({
    ...mature(typeId).business,
    branches,
    last: {
      year: 2011,
      revenue: 500_000,
      costs: 400_000,
      profit: 100_000,
      drawn: 50_000,
      injected: 0,
      turnedAway: 0,
      idle: 0,
    },
  });

  it('is exactly the old maturity for a business with one door', () => {
    const type = findBusinessType('biz.cafe')!;
    for (const year of [2001, 2004, 2012]) {
      expect(footprintFor(owned('biz.cafe'), type, year)).toBeCloseTo(
        maturityFor(year - 2000 - 1, type.ramp),
        10,
      );
    }
    expect(locationsOf(owned('biz.cafe'))).toBe(1);
  });

  it('shares custom between doors, each a little less than the last', () => {
    expect(LOCATION_SHARE).toHaveLength(MAX_LOCATIONS);
    for (let i = 1; i < LOCATION_SHARE.length; i += 1) {
      expect(LOCATION_SHARE[i]!).toBeLessThan(LOCATION_SHARE[i - 1]!);
    }
    expect(reachOf(1)).toBe(1);
    expect(reachOf(2)).toBeGreaterThan(1.5);
    expect(reachOf(2)).toBeLessThan(2);
    expect(reachOf(4)).toBeLessThan(4);
  });

  it('opens a branch better than a stranger and grows it to maturity', () => {
    const type = findBusinessType('biz.cafe')!;
    const two = owned('biz.cafe', [2010]);
    const justOpened = footprintFor(two, type, 2011) - footprintFor(owned('biz.cafe'), type, 2011);
    // It opens at 65% of a mature door at least, where a stranger opens at 55%.
    expect(justOpened).toBeGreaterThan(0.9 * 0.65);
    const later = footprintFor(two, type, 2030) - footprintFor(owned('biz.cafe'), type, 2030);
    expect(later).toBeCloseTo(LOCATION_SHARE[1]!, 1);
  });

  it('costs a branch less than a first location, and the fittings are its own', () => {
    const type = findBusinessType('biz.restaurant')!;
    expect(branchCostFor(type)).toBe(Math.round(type.startup * BRANCH_COST_SHARE));
    expect(branchCostFor(type)).toBeLessThan(type.startup);
    const single = assetValueFor(type, 2000, 2005);
    const double = assetValueFor(type, 2000, 2005, [2005]);
    expect(double - single).toBe(Math.round(type.startup * BRANCH_COST_SHARE * type.assetShare));
  });

  it('adds a branch: its fittings and float, its own crew, and the cost to what is invested', () => {
    const { business, type } = mature('biz.cafe');
    const cost = branchCostFor(type);
    const grown = withBranch({ ...business, staff: type.staffMin }, type, 2012);
    expect(grown.branches).toEqual([2012]);
    expect(Number(grown.invested) / 100 - Number(business.invested) / 100).toBe(cost);
    expect(Number(grown.cash) / 100 - Number(business.cash) / 100).toBe(
      Math.round(cost * (1 - type.assetShare)),
    );
    expect(grown.staff).toBe(type.staffMin * 2);
  });

  it('charges a branch its own lease, and sells to the custom that comes with it', () => {
    const { business, type } = mature('biz.cleaning');
    const one = businessYear(business, type, NORMAL);
    const twoDoors = { ...business, branches: [1990], staff: business.staff * 2 };
    const two = businessYear(twoDoors, type, NORMAL);
    // A second lease at three quarters of the first: stated as a number, not
    // read back from the constant it guards (CORE_RULES 13.92).
    expect(two.overhead).toBe(Math.round(type.overhead * 1.75));
    expect(BRANCH_OVERHEAD_SHARE).toBeGreaterThan(0.5);
    expect(BRANCH_OVERHEAD_SHARE).toBeLessThan(1);
    expect(two.demand).toBeGreaterThan(one.demand * 1.7);
    expect(two.demand).toBeLessThan(one.demand * 2);
  });

  it('puts one owner at one door: more doors, less of the owner in each', () => {
    const { business, type } = mature('biz.cleaning');
    const one = businessYear({ ...business, staff: 6 }, type, NORMAL);
    const two = businessYear({ ...business, branches: [1990], staff: 6 }, type, NORMAL);
    // Same crew at two doors can't serve two doors' custom.
    expect(two.capacity).toBeLessThan(one.capacity);
    expect(two.turnedAway).toBeGreaterThan(one.turnedAway);
  });

  it('refuses for the right reason, in order', () => {
    const { type } = mature('biz.cafe');
    const ok = owned('biz.cafe');
    expect(expansionRefusal(ok, type, 2012, 1e9)).toBeUndefined();
    expect(expansionRefusal(owned('biz.cafe', [2012, 2013, 2014]), type, 2030, 1e9)).toBe(
      'at-limit',
    );
    expect(expansionRefusal(ok, type, 2000 + EXPAND_AFTER_YEARS - 1, 1e9)).toBe('too-new');
    expect(expansionRefusal(owned('biz.cafe', [2011]), type, 2012, 1e9)).toBe('too-new');
    expect(expansionRefusal({ ...ok, last: { ...ok.last!, profit: -1 } }, type, 2012, 1e9)).toBe(
      'not-earning',
    );
    expect(expansionRefusal({ ...ok, last: undefined }, type, 2012, 1e9)).toBe('not-earning');
    expect(expansionRefusal(ok, type, 2012, branchCostFor(type) - 1)).toBe('cannot-afford');
    expect(Object.keys(EXPAND_REFUSAL_LABELS).sort()).toEqual([
      'at-limit',
      'cannot-afford',
      'not-earning',
      'too-new',
    ]);
  });

  it('closes the newest door for part of what its fittings are worth', () => {
    const { type } = mature('biz.cafe');
    const two = owned('biz.cafe', [2008, 2010]);
    const fetched = branchWindDownOf(two, type, 2012);
    expect(fetched).toBeGreaterThan(0);
    expect(fetched).toBeLessThan(branchCostFor(type) * type.assetShare);
    const smaller = withoutBranch(two, type);
    expect(smaller.branches).toEqual([2008]);
    expect(branchWindDownOf(owned('biz.cafe'), type, 2012)).toBe(0);
  });

  it('pays back on a first branch for the trades that scale, once the manager has staffed it', () => {
    const settle = (business: OwnedBusiness, type: (typeof BUSINESS_TYPES)[number]) => {
      let next = business;
      for (let round = 0; round < 10; round += 1) {
        const year = businessYear(next, type, { ...NORMAL, year: 2030 });
        next = { ...next, staff: autoStaffFor(type, next.staff, year, 1, 0.7, locationsOf(next)) };
      }
      return businessYear(next, type, { ...NORMAL, year: 2030 }).profit;
    };
    for (const id of [
      'biz.cleaning',
      'biz.landscaping',
      'biz.salon',
      'biz.cafe',
      'biz.fitness',
      'biz.autorepair',
      'biz.restaurant',
      'biz.clothing',
      'biz.hvac',
    ]) {
      const { business, type } = mature(id);
      const alone = settle(business, type);
      const one = settle({ ...business, branches: [2000] }, type);
      const two = settle({ ...business, branches: [2000, 2000] }, type);
      expect(one, id).toBeGreaterThan(alone);
      // Each further door multiplies by less than the one before: the custom
      // is shared, and one owner is spread thinner.
      expect(two / one, id).toBeLessThan(one / alone);
    }
  });
});

describe('Ticket 0602 — things the bigger catalog forced', () => {
  it('derives each type’s price sensitivity from its own costs', () => {
    // p* = e/(e-1) * mc puts the profit-maximising price at the going price when
    // e = 1/(1-mc); the catalog uses 0.95 of that, so the best price sits a
    // little above going. A typed-in number that drifts from this is the bug
    // 0601 shipped: half the catalog had its best price at 125-135%.
    for (const type of BUSINESS_TYPES) {
      const mc = type.cogs + (type.staff * type.wage) / type.revenue / type.headroom;
      const expected = Math.min(5, Math.max(1.6, 0.95 / (1 - mc)));
      expect(type.elasticity, type.id).toBeCloseTo(expected, 1);
    }
  });

  it('lets a big firm find its staff in a few years, not a dozen', () => {
    const resort = findBusinessType('biz.resort')!;
    const hungry = { demand: resort.revenue * 10 };
    const next = autoStaffFor(resort, 40, hungry, 1, 1);
    expect(next).toBeGreaterThanOrEqual(46);
    // And a small shop still takes them a few at a time.
    const cleaning = findBusinessType('biz.cleaning')!;
    expect(autoStaffFor(cleaning, 2, { demand: cleaning.revenue * 10 }, 1, 1)).toBe(5);
  });

  it('lets a lot of cars move less with the pay than a law firm does', () => {
    const rental = mature('biz.vehiclerental');
    const law = mature('biz.law');
    const lift = (m: ReturnType<typeof mature>) => {
      const base = businessYear(m.business, m.type, NORMAL).demand;
      const paid = businessYear({ ...m.business, payroll: 'bigBucks' }, m.type, NORMAL).demand;
      return paid / base;
    };
    expect(lift(rental)).toBeLessThan(lift(law));
  });
});
