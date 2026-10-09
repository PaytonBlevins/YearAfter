import { describe, expect, it } from 'vitest';
import { mixedUnit } from '@yearafter/core';
import { EDUCATION_ORDER } from '@yearafter/education';
import { ALL_JOBS, findJob } from './jobs';
import { afterTax } from './pay';
import { partnerYear, partnerWorkOf, retirementAgeOf } from './partner';
import {
  startPartnerCareer,
  advancePartnerCareer,
  legacyPartnerCareer,
  type PartnerCareerInput,
} from './partner-career';
const input = (n = 0, age = 30): PartnerCareerInput => ({
  id: `p16-${n}`,
  seed: 'career-test',
  age,
  youngChild: false,
  worldYear: 2000 + age,
  playerPay: 60_000,
});
const normal = (k: string) =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, mixedUnit(`${k}:a`)))) *
  Math.cos(2 * Math.PI * mixedUnit(`${k}:b`));
describe('P16 autonomous careers', () => {
  it('matches once with the approved geometric blend and catalog quote, keyed to each life', () => {
    for (let n = 0; n < 100; n++) {
      const i = input(n);
      const c = startPartnerCareer(i);
      const key = `${i.seed}:${i.id}`;
      const pool = ALL_JOBS.filter((j) => j.minAge <= i.age);
      const background = pool[Math.floor(mixedUnit(`p16:${key}:background`) * pool.length)]!;
      const target =
        Math.exp(0.05 * Math.log(background.pay) + 0.95 * Math.log(i.playerPay)) *
        Math.exp(0.2 * normal(`p16:${key}:initial`));
      const job = [...pool].sort(
        (a, b) => Math.abs(Math.log(a.pay / target)) - Math.abs(Math.log(b.pay / target)),
      )[0]!;
      expect(c.jobId).toBe(job.id);
      expect(c.salary).toBe(Math.round(job.pay * Math.exp(0.12 * normal(`p16:${key}:quote`))));
      const style = mixedUnit(`p16:${key}:type`);
      expect(c.style).toBe(style < 0.2 ? 'steady' : style < 0.8 ? 'ordinary' : 'mobile');
      expect(c.last.status).toBe(partnerWorkOf(i));
      expect(c.last.net).toBe(afterTax(c.last.gross));
      expect(startPartnerCareer(i)).toEqual(c);
    }
    expect(startPartnerCareer(input())).not.toEqual(
      startPartnerCareer({ ...input(), seed: 'different-life' }),
    );
  });
  it('clips only positive player context and initializes non-earners/retirees independently', () => {
    const i = input();
    expect(startPartnerCareer({ ...i, playerPay: 1 })).toEqual(
      startPartnerCareer({ ...i, playerPay: 20000 }),
    );
    expect(startPartnerCareer({ ...i, playerPay: 1_000_000 })).toEqual(
      startPartnerCareer({ ...i, playerPay: 400000 }),
    );
    expect(startPartnerCareer({ ...i, playerPay: 0 })).toEqual(
      startPartnerCareer({ ...i, playerPay: -10 }),
    );
    const old = input(0, 70);
    expect(startPartnerCareer({ ...old, playerPay: 0 })).toEqual(
      startPartnerCareer({ ...old, playerPay: 400000 }),
    );
  });
  it('never rematches existing careers when player pay changes and is immutable/idempotent', () => {
    const i = input();
    const c = startPartnerCareer(i);
    const frozen = JSON.stringify(c);
    const next = { ...i, age: 40, worldYear: 2040 };
    expect(advancePartnerCareer({ ...next, playerPay: 1 }, c)).toEqual(
      advancePartnerCareer({ ...next, playerPay: 400000 }, c),
    );
    expect(JSON.stringify(c)).toBe(frozen);
    expect(advancePartnerCareer(i, c)).toBe(c);
  });
  it('keeps steady wages, freezes own final pension and catches up without rerolling', () => {
    for (let n = 0; n < 100; n++) {
      const i = input(n);
      const c = startPartnerCareer(i);
      const retire = retirementAgeOf(i.id);
      const pre = advancePartnerCareer({ ...i, age: retire - 1, worldYear: 2000 + retire - 1 }, c);
      const retired = advancePartnerCareer({ ...i, age: retire, worldYear: 2000 + retire }, pre);
      const later = advancePartnerCareer({ ...i, age: 90, worldYear: 2090 }, retired);
      expect(retired.salary).toBe(pre.salary);
      expect(retired.last.gross).toBe(Math.round(pre.salary * 0.4));
      expect(later.last).toEqual(retired.last);
      expect(later.salary).toBe(retired.salary);
      const caught = advancePartnerCareer({ ...i, age: 50, worldYear: 2050 }, c);
      let sequential = c;
      for (let age = 31; age <= 50; age++)
        sequential = advancePartnerCareer({ ...i, age, worldYear: 2000 + age }, sequential);
      expect(caught).toEqual(sequential);
      if (c.style === 'steady') expect(caught.salary).toBe(c.salary);
    }
  });
  it('uses the approved raise/move/promotion/cut probabilities and bounds, respects age and credentials', () => {
    const observed = new Set<string>();
    for (let n = 0; n < 600; n++) {
      const i = input(n);
      let c = startPartnerCareer(i);
      for (let age = 31; age < 62; age++) {
        const previous = c;
        c = advancePartnerCareer({ ...i, age, worldYear: 2000 + age }, c);
        const job = findJob(c.jobId)!;
        expect(job.minAge).toBeLessThanOrEqual(age);
        expect(EDUCATION_ORDER.indexOf(job.requires)).toBeLessThanOrEqual(
          EDUCATION_ORDER.indexOf(c.credential),
        );
        expect(!job.license || job.license === c.license).toBe(true);
        if (c.style !== 'steady') {
          expect(c.salary).toBeGreaterThanOrEqual(20000);
          expect(c.salary).toBeLessThanOrEqual(Math.round(job.pay * 1.9));
        }
        observed.add(c.change);
        if (previous.style !== 'steady') {
          const key = `${i.seed}:${i.id}`;
          const event = mixedUnit(`p16:${key}:event:${2000 + age}`);
          const chance = previous.style === 'ordinary' ? 0.04 : 0.08;
          const oldJob = findJob(previous.jobId)!;
          const qualified = (j: typeof oldJob) =>
            j.minAge <= age &&
            EDUCATION_ORDER.indexOf(j.requires) <= EDUCATION_ORDER.indexOf(previous.credential) &&
            (!j.license || j.license === previous.license);
          let expectedJob = oldJob;
          let expectedSalary = Math.round(
            previous.salary * (previous.style === 'ordinary' ? 1.01 : 1.015),
          );
          if (event < chance) {
            const target =
              expectedSalary * Math.exp(0.2 * normal(`p16:${key}:switch:${2000 + age}`));
            expectedJob = ALL_JOBS.filter(
              (j) => j.track === oldJob.track && j.rung === oldJob.rung && qualified(j),
            ).sort(
              (a, b) => Math.abs(Math.log(a.pay / target)) - Math.abs(Math.log(b.pay / target)),
            )[0]!;
            expectedSalary = Math.round(
              expectedSalary *
                (expectedJob.pay / oldJob.pay) *
                Math.exp(0.08 * normal(`p16:${key}:offer:${2000 + age}`)),
            );
          } else if (event < chance + 0.03) {
            const promoted = ALL_JOBS.find(
              (j) => j.track === oldJob.track && j.rung === oldJob.rung + 1 && qualified(j),
            );
            if (promoted) {
              expectedJob = promoted;
              expectedSalary = Math.round(expectedSalary * (promoted.pay / oldJob.pay));
            }
          } else if (event < chance + 0.06)
            expectedSalary = Math.round(
              expectedSalary * (0.85 + 0.09 * mixedUnit(`p16:${key}:cut:${2000 + age}`)),
            );
          expect(c.jobId).toBe(expectedJob.id);
          expect(c.salary).toBe(
            Math.max(20000, Math.min(Math.round(expectedJob.pay * 1.9), expectedSalary)),
          );
        }
      }
    }
    for (const change of ['raise', 'cut', 'moved', 'promoted', 'returned', 'stopped'])
      expect(observed.has(change)).toBe(true);
  });
  it('retains the 20/60/20 styles and a real low/high pay range instead of a fixed median', () => {
    const cs = Array.from({ length: 2000 }, (_, n) =>
      startPartnerCareer({ ...input(n), playerPay: 0 }),
    );
    for (const [style, share] of [
      ['steady', 0.2],
      ['ordinary', 0.6],
      ['mobile', 0.2],
    ] as const)
      expect(cs.filter((c) => c.style === style).length / cs.length).toBeCloseTo(share, 1);
    expect(Math.min(...cs.map((c) => c.salary))).toBeLessThan(25000);
    expect(Math.max(...cs.map((c) => c.salary))).toBeGreaterThan(250000);
  });
  it('applies the annual $20k floor to real low initial catalog quotes', () => {
    let reachedFloor = 0;
    for (let n = 0; n < 500; n++) {
      const i = { ...input(n), playerPay: 20000 };
      const c = startPartnerCareer(i);
      if (c.style === 'steady' || c.salary >= 20000) continue;
      const next = advancePartnerCareer({ ...i, age: 31, worldYear: 2031 }, c);
      expect(next.salary).toBeGreaterThanOrEqual(20000);
      if (next.salary === 20000) reachedFloor++;
    }
    expect(reachedFloor).toBeGreaterThan(10);
  });
  it('preserves young/minor participation and exact legacy current income, including out-of-work spells and pensions', () => {
    for (let age of [18, 21, 22, 35, 70])
      for (let n = 0; n < 50; n++) {
        const i = input(n, age);
        const c = legacyPartnerCareer(i);
        expect(c.last).toEqual(partnerYear(i));
        expect(c.jobSince).toBe(i.worldYear);
        expect(c.year).toBe(i.worldYear);
        if (age === 70)
          expect(
            advancePartnerCareer({ ...i, age: 71, worldYear: i.worldYear + 1 }, c).last,
          ).toEqual(c.last);
        const fresh = startPartnerCareer(i);
        expect(fresh.last.status).toBe(partnerWorkOf(i));
        if (fresh.last.status === 'working')
          expect(fresh.last.gross).toBe(Math.round(fresh.salary * (age < 22 ? 0.5 : 1)));
      }
    expect(partnerWorkOf({ ...input(), age: 17 })).toBe('notWorking');
  });
});
