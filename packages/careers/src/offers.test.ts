/**
 * Ticket 0402 — the model behind an offer.
 *
 * `offerChance` decides how often the only question this game asks an adult
 * gets asked at all, and `offerFor` decides what it is for. Both are pure, both
 * were tuned against measurements, and these are the rules those measurements
 * depend on.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_JOBS,
  NOTICED_AT_STANDING,
  OFFER_CEILING,
  SETTLED_FOR_YEARS,
  offerChance,
  offerFor,
  type Job,
} from './index';

const ok = { standing: 80, performance: 80, years: 10 };

describe('offerChance — who gets noticed', () => {
  it('never offers anything to somebody their field does not rate', () => {
    expect(offerChance(NOTICED_AT_STANDING - 1, 100, 40)).toBe(0);
    expect(offerChance(NOTICED_AT_STANDING, 100, 40)).toBeGreaterThan(0);
  });

  it('never headhunts somebody out of a job they just started', () => {
    expect(offerChance(100, 100, SETTLED_FOR_YEARS - 1)).toBe(0);
    expect(offerChance(100, 100, SETTLED_FOR_YEARS)).toBeGreaterThan(0);
  });

  it('never exceeds its own ceiling, at any input', () => {
    /*
      A DERIVED SWEEP, not three spot checks. The ceiling is the number the rate
      was tuned on — median 2 offers a life, 25.8% of lives never offered one —
      and a formula that can quietly exceed it makes that tuning a fiction.
    */
    for (let standing = 0; standing <= 100; standing += 5) {
      for (let performance = 0; performance <= 100; performance += 5) {
        for (let years = 0; years <= 40; years += 2) {
          const chance = offerChance(standing, performance, years);
          expect(chance).toBeGreaterThanOrEqual(0);
          expect(chance).toBeLessThanOrEqual(OFFER_CEILING);
        }
      }
    }
  });

  it('rises with every one of its three inputs and nothing else', () => {
    expect(offerChance(90, ok.performance, ok.years)).toBeGreaterThan(
      offerChance(70, ok.performance, ok.years),
    );
    expect(offerChance(ok.standing, 90, ok.years)).toBeGreaterThan(
      offerChance(ok.standing, 60, ok.years),
    );
    expect(offerChance(ok.standing, ok.performance, 12)).toBeGreaterThan(
      offerChance(ok.standing, ok.performance, 3),
    );
  });

  it('does not headhunt somebody having a bad year, however well regarded', () => {
    // The best-regarded person in the catalog, having a poor year, must come in
    // below an ordinary person having a good one.
    expect(offerChance(100, 30, 20)).toBeLessThan(offerChance(70, 85, 20));
  });
});

describe('offerFor — what the offer is for', () => {
  const byPay = [...ALL_JOBS].sort((a, b) => a.pay - b.pay);
  const cheap = byPay[0] as Job;
  const dear = byPay[byPay.length - 1] as Job;

  it('offers nothing when nothing on the table pays more', () => {
    expect(offerFor(ALL_JOBS, dear, 0.5)).toBeUndefined();
    expect(offerFor([cheap], cheap, 0.5)).toBeUndefined();
  });

  it('never names a job that pays the same or less', () => {
    const middle = byPay[Math.floor(byPay.length / 2)] as Job;
    for (let draw = 0; draw < 1; draw += 0.02) {
      const offered = offerFor(ALL_JOBS, middle, draw);
      if (!offered) continue;
      expect(offered.pay).toBeGreaterThan(middle.pay);
    }
  });

  it('never names a job that was not on the table', () => {
    /*
      THE GATE IS NOT ROUTED AROUND. `offerFor` is handed the eligible set and
      may only choose within it — an offer for a job the character could not
      have applied to would be the game walking past its own `cannotApply`,
      which is the defect 0401 existed to fix, arriving through a new door.
    */
    const table = byPay.slice(0, 8);
    const from = byPay[0] as Job;
    const ids = new Set(table.map((job) => String(job.id)));
    for (let draw = 0; draw < 1; draw += 0.05) {
      const offered = offerFor(table, from, draw);
      if (offered) expect(ids.has(String(offered.id))).toBe(true);
    }
  });

  it('does not name the same job every time', () => {
    /*
      13.26 — a row that says the same thing on every occasion is a row the
      player stops reading. Always naming the highest-paid eligible job would
      make every offer in the game one of a handful of titles.
    */
    const from = byPay[2] as Job;
    const named = new Set<string>();
    for (let draw = 0; draw < 1; draw += 0.01) {
      const offered = offerFor(ALL_JOBS, from, draw);
      if (offered) named.add(String(offered.id));
    }
    expect(named.size).toBeGreaterThan(3);
  });

  it('still favours the better-paid, so an offer is worth having', () => {
    const from = byPay[2] as Job;
    const picks: Job[] = [];
    for (let draw = 0; draw < 1; draw += 0.01) {
      const offered = offerFor(ALL_JOBS, from, draw);
      if (offered) picks.push(offered);
    }
    const better = ALL_JOBS.filter((job) => job.pay > from.pay);
    const best = better.reduce((a, b) => (b.pay > a.pay ? b : a));
    const timesBest = picks.filter((job) => String(job.id) === String(best.id)).length;
    // The top one is the single most likely outcome without being the only one.
    expect(timesBest).toBeGreaterThan(picks.length / better.length);
  });
});
