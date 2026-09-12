/**
 * Ticket 0210 — measuring the career model before anything uses it.
 *
 * CORE_RULES 13.7 and 13.21, and the third ticket running to do it in this
 * order. 0209 measured first and caught two defects at design time that would
 * otherwise have shipped; this does the same for hiring, pay and the ladder.
 *
 * These are not assertions dressed as measurements — they assert the SHAPE the
 * numbers were tuned to produce, so that changing a constant without rerunning
 * the tuning fails here rather than in a played life six tickets later.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_JOBS,
  ALL_TRACKS,
  START_STANDING,
  afterTax,
  findJob,
  firingChance,
  hireChance,
  oddsLabel,
  livingShare,
  payBreakdown,
  payFor,
  promotionChance,
  promotionFrom,
  savedFrom,
  TEMPLATES,
  taxRate,
  topOfLadder,
  type Applicant,
} from './index';

const leaver: Applicant = {
  age: 18,
  smarts: 77,
  charisma: 76,
  discipline: 68,
  looks: 60,
  education: 'highSchool' as const,
  opens: [] as readonly string[],
  experience: 0,
  standing: START_STANDING,
  reached: -1,
};

/** Measured across 300 lives before this package existed. See `pay.ts`. */
const MEDIAN_SCHOOL_LEAVER = leaver;

describe('the catalog is a set of ladders', () => {
  it('has a way in on every track', () => {
    for (const track of ALL_TRACKS) {
      const entry = ALL_JOBS.filter((job) => job.track === track && job.rung === 0);
      expect(entry.length, track).toBeGreaterThan(0);
    }
  });

  it('never offers a promotion that pays less', () => {
    for (const job of ALL_JOBS) {
      const next = promotionFrom(job);
      if (!next) continue;
      expect(next.pay, `${job.title} -> ${next.title}`).toBeGreaterThan(job.pay);
    }
  });

  it('gives every track somewhere to stop', () => {
    for (const track of ALL_TRACKS) {
      const tops = ALL_JOBS.filter((job) => job.track === track && topOfLadder(job));
      expect(tops.length, track).toBeGreaterThan(0);
    }
  });
});

describe('a school leaver can actually get hired', () => {
  it('has real odds at the bottom of several ladders', () => {
    // CORE_RULES 13.16. The whole system is unreachable if the population the
    // build produces cannot get through the first door — which is exactly how
    // the $9,000 wedding and the $650 school play shipped.
    const doors = ALL_JOBS.filter((job) => job.rung === 0);
    const odds = doors.map((job) => hireChance(job, MEDIAN_SCHOOL_LEAVER));
    const decent = odds.filter((chance) => chance >= 0.4);
    expect(
      decent.length,
      `only ${decent.length} of ${doors.length} doors are open`,
    ).toBeGreaterThan(6);
    expect(Math.max(...odds)).toBeGreaterThan(0.55);
  });

  it('cannot walk into a job two rungs up', () => {
    const director = findJob('job.office.director');
    expect(director).toBeDefined();
    expect(hireChance(director!, MEDIAN_SCHOOL_LEAVER)).toBeLessThan(0.12);
  });

  it('makes leaving school early harder without closing anything', () => {
    const dropout: Applicant = { ...MEDIAN_SCHOOL_LEAVER, education: 'none' };
    let worseSomewhere = false;
    for (const job of ALL_JOBS.filter((entry) => entry.rung === 0)) {
      const withPaper = hireChance(job, MEDIAN_SCHOOL_LEAVER);
      const without = hireChance(job, dropout);
      expect(without, job.title).toBeGreaterThan(0.02);
      if (without < withPaper - 0.05) worseSomewhere = true;
    }
    expect(worseSomewhere).toBe(true);
    // And the doors that expect nothing are exactly as open either way.
    const open = ALL_JOBS.filter(
      (job) => job.rung === 0 && job.requires === 'none' && job.prefers === 'none',
    );
    for (const job of open) {
      expect(hireChance(job, dropout), job.title).toBeCloseTo(
        hireChance(job, MEDIAN_SCHOOL_LEAVER),
        5,
      );
    }
  });

  it('wants a different person in a kitchen than in a warehouse', () => {
    // Measured, and the first version failed this badly: with charisma and
    // smarts weighted only for sales and office, NINE OF TWELVE entry-level
    // jobs came out at exactly 0.56 for the same applicant, and a screenshot of
    // the openings screen showed six rows all reading "Worth a shot". Which
    // job you applied for did not matter, which is the whole screen not
    // mattering.
    const charmer: Applicant = {
      ...MEDIAN_SCHOOL_LEAVER,
      charisma: 92,
      smarts: 55,
      discipline: 45,
    };
    const grafter: Applicant = {
      ...MEDIAN_SCHOOL_LEAVER,
      charisma: 45,
      smarts: 58,
      discipline: 90,
    };
    const sales = findJob('job.sales.retail')!;
    const warehouse = findJob('job.logistics.picker')!;

    expect(hireChance(sales, charmer)).toBeGreaterThan(hireChance(sales, grafter) + 0.15);
    expect(hireChance(warehouse, grafter)).toBeGreaterThan(hireChance(warehouse, charmer) + 0.15);

    // And each one's best door is not the other's.
    const doors = ALL_JOBS.filter((job) => job.rung === 0);
    const bestFor = (who: Applicant) =>
      [...doors].sort((a, b) => hireChance(b, who) - hireChance(a, who))[0]!.track;
    expect(bestFor(charmer)).not.toBe(bestFor(grafter));
  });

  it('says something different on rows with different odds', () => {
    // A column that reads the same on every row is a column players stop
    // reading. Banded against the measured distribution rather than round
    // numbers — see `oddsLabel`.
    const said = new Set(
      ALL_JOBS.filter((job) => job.rung <= 1).map((job) =>
        oddsLabel(hireChance(job, { ...MEDIAN_SCHOOL_LEAVER, reached: 0, standing: 78 })),
      ),
    );
    expect(said.size).toBeGreaterThan(1);
  });

  it('is worth being known in the field', () => {
    const job = findJob('job.retail.keyholder')!;
    const stranger = hireChance(job, { ...MEDIAN_SCHOOL_LEAVER, reached: 0 });
    const known = hireChance(job, {
      ...MEDIAN_SCHOOL_LEAVER,
      reached: 0,
      standing: 85,
      experience: 5,
    });
    expect(known - stranger).toBeGreaterThan(0.2);
  });
});

describe('pay', () => {
  it('taxes more of a large income than a small one', () => {
    expect(taxRate(28_000)).toBeLessThan(taxRate(120_000));
    expect(taxRate(120_000)).toBeLessThan(taxRate(400_000));
    expect(taxRate(28_000)).toBeGreaterThan(0.1);
    expect(taxRate(2_000_000)).toBeLessThanOrEqual(0.34);
  });

  it('leaves a small wage almost nothing and a large one something', () => {
    // The shape the whole system depends on, and it was retuned once already:
    // the first values put a character on a median salary at $226,000 by fifty
    // and a driven one at $467,000, which would have made every price in the
    // game free. Savings appear properly only well up the income scale.
    const poor = savedFrom(27_000, 0);
    const middling = savedFrom(58_000, 0);
    const rich = savedFrom(130_000, 0);
    expect(poor).toBeGreaterThan(0);
    expect(poor).toBeLessThan(2_000);
    expect(middling).toBeGreaterThan(poor);
    expect(middling).toBeLessThan(6_000);
    expect(rich).toBeGreaterThan(11_000);
    // And nobody banks most of what they earn.
    expect(rich / afterTax(130_000)).toBeLessThan(0.25);
  });

  it('makes a family cost something', () => {
    const alone = savedFrom(46_000, 0);
    const withThree = savedFrom(46_000, 3);
    expect(withThree).toBeLessThan(alone);
    expect(livingShare(afterTax(46_000), 3)).toBeGreaterThan(livingShare(afterTax(46_000), 0));
  });

  it('can leave a household going backwards', () => {
    // A small wage and four dependents does not break even, and it should not.
    // The employment phase is responsible for never taking cash below zero.
    expect(savedFrom(25_000, 4)).toBeLessThan(savedFrom(25_000, 0));
  });

  it('pays a salaried job the same either way and a commissioned one very differently', () => {
    const salaried = findJob('job.retail.floor')!;
    const commissioned = findJob('job.sales.realestate')!;

    const badSalaried = payFor(salaried, 3, 25, 40);
    const goodSalaried = payFor(salaried, 3, 90, 80);
    const badSales = payFor(commissioned, 3, 25, 40);
    const goodSales = payFor(commissioned, 3, 90, 80);

    expect(goodSalaried / badSalaried).toBeLessThan(1.12);
    // Spec 1394 asks performance careers for "broad earnings distributions".
    expect(goodSales / badSales).toBeGreaterThan(1.8);
  });

  it('rewards staying without turning attendance into a fortune', () => {
    const job = findJob('job.trades.electrician')!;
    const first = payFor(job, 0, 60, 50);
    const twentieth = payFor(job, 20, 60, 50);
    expect(twentieth).toBeGreaterThan(first * 1.2);
    expect(twentieth).toBeLessThan(first * 2);
  });
});

describe('moving up and being let go', () => {
  it('never promotes somebody having a bad year', () => {
    const job = findJob('job.office.admin')!;
    expect(promotionChance(job, 40, 60, 5)).toBe(0);
  });

  it('does not promote anybody in their first year', () => {
    const job = findJob('job.office.admin')!;
    expect(promotionChance(job, 90, 70, 0)).toBeLessThan(0.03);
  });

  it('gets a good employee up a ladder in a working lifetime', () => {
    // Measured rather than asserted from feel: at 78 performance and average
    // standing, roughly how many years to a promotion?
    const job = findJob('job.retail.floor')!;
    const chance = promotionChance(job, 78, 55, 4);
    expect(chance).toBeGreaterThan(0.06);
    expect(1 / chance).toBeLessThan(15);
  });

  it('rarely fires somebody who is doing the job', () => {
    for (const job of ALL_JOBS) {
      const chance = firingChance(job, 75, 6);
      expect(chance, job.title).toBeLessThan(0.02);
    }
  });

  it('lets somebody go who is not', () => {
    const job = findJob('job.food.crew')!;
    expect(firingChance(job, 20, 2)).toBeGreaterThan(0.1);
  });

  it('protects a government job and exposes a commissioned one', () => {
    const clerk = findJob('job.public.clerk')!;
    const broker = findJob('job.sales.broker')!;
    expect(firingChance(broker, 35, 4)).toBeGreaterThan(firingChance(clerk, 35, 4) * 3);
  });
});

describe('Ticket 0301 — the breakdown is the same year, itemised', () => {
  it('adds up to savedFrom, exactly, for every job at every stage', () => {
    /*
      The property that makes 0301 reviewable: the ledger is bookkeeping, not a
      rebalance. If `payBreakdown` and `savedFrom` ever disagree, somebody has
      quietly changed everybody's income while claiming to add a record of it.
    */
    for (const job of ALL_JOBS) {
      for (const years of [0, 4, 20]) {
        for (const performance of [20, 50, 85]) {
          for (const dependents of [0, 3]) {
            const parts = payBreakdown(job, years, performance, 50, dependents);
            const gross = payFor(job, years, performance, 50);
            expect(parts.steady + parts.commission, `${job.id} gross`).toBe(gross);
            expect(parts.saved, `${job.id} saved`).toBe(savedFrom(gross, dependents));
            expect(gross - parts.tax - parts.living, `${job.id} identity`).toBe(parts.saved);
          }
        }
      }
    }
  });

  it('splits steady from commission the way the template says', () => {
    // A salaried job is nearly all steady; a commissioned one is not. That
    // difference is the performance template spec 1394 asks for by name, and
    // this is the only place in the build that can see it.
    const salaried = ALL_JOBS.filter((job) => TEMPLATES[job.template].atRisk <= 0.06);
    const commissioned = ALL_JOBS.filter((job) => TEMPLATES[job.template].atRisk >= 0.3);
    expect(salaried.length, 'no salaried jobs to test').toBeGreaterThan(0);
    expect(commissioned.length, 'no commissioned jobs to test').toBeGreaterThan(0);

    const shareOf = (job: (typeof ALL_JOBS)[number]) => {
      const parts = payBreakdown(job, 5, 75, 60, 0);
      return parts.commission / Math.max(1, parts.steady + parts.commission);
    };
    const salariedShare = salaried.map(shareOf).reduce((a, b) => a + b, 0) / salaried.length;
    const commissionShare =
      commissioned.map(shareOf).reduce((a, b) => a + b, 0) / commissioned.length;
    expect(salariedShare).toBeLessThan(0.15);
    expect(commissionShare).toBeGreaterThan(salariedShare * 2);
  });

  it('never reports a negative tax or a negative living cost', () => {
    // Both are posted to the ledger as outgoings. A negative one would be
    // income wearing the wrong category, which is the kind of thing that only
    // shows up on a dashboard two tickets later.
    for (const job of ALL_JOBS) {
      for (const performance of [0, 50, 100]) {
        const parts = payBreakdown(job, 0, performance, 0, 4);
        expect(parts.tax, `${job.id} tax`).toBeGreaterThanOrEqual(0);
        expect(parts.living, `${job.id} living`).toBeGreaterThanOrEqual(0);
        expect(parts.steady, `${job.id} steady`).toBeGreaterThanOrEqual(0);
        expect(parts.commission, `${job.id} commission`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
