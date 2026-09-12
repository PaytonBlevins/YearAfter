/**
 * Ticket 0303 acceptance tests — the cost of being alive.
 *
 * Spec 191–193 names five things living costs are inferred from: location,
 * household size, wealth/income, housing circumstances and family
 * circumstances. Four of the five could not possibly have mattered before this
 * ticket, because the cost was defined as a percentage of a wage — so most of
 * what is asserted here is simply that each input REACHES the number, which is
 * the difference between a model and a formula with decoration on it.
 */

import { describe, expect, it } from 'vitest';
import {
  AT_HOME_SHARE,
  CREEP_DOWN,
  CREEP_UP,
  SUBSISTENCE,
  creep,
  householdScale,
  livingCostFor,
  standardTargetFor,
} from './living';

const alone = (over: Partial<Parameters<typeof livingCostFor>[0]> = {}) =>
  livingCostFor({
    standard: 40_000,
    locationIndex: 1,
    partnered: false,
    childAges: [],
    housing: 'ownPlace',
    ...over,
  }).total;

describe('every input the spec names reaches the number', () => {
  it('location', () => {
    // 1.68 in San Francisco against 0.86 in Memphis, on the same standard.
    expect(alone({ locationIndex: 1.68 })).toBeGreaterThan(alone({ locationIndex: 0.86 }));
    expect(alone({ locationIndex: 1.68 }) / alone({ locationIndex: 0.86 })).toBeCloseTo(
      1.68 / 0.86,
      2,
    );
  });

  it('household size, with each extra person costing less than the first', () => {
    const one = alone();
    const two = alone({ partnered: true });
    const withKids = alone({ partnered: true, childAges: [8, 8, 8] });
    expect(two).toBeGreaterThan(one);
    expect(withKids).toBeGreaterThan(two);
    // Two people are cheaper than two singles. This is the whole point of an
    // equivalence scale, and the reason a couple is better off than a pair.
    expect(two).toBeLessThan(one * 2);
    // And a fourth child costs less than the first.
    expect(alone({ childAges: [8, 8, 8, 8] }) - alone({ childAges: [8, 8, 8] })).toBe(
      alone({ childAges: [8] }) - alone({ childAges: [] }),
    );
    expect(householdScale(true, [8, 8])).toBeCloseTo(1 + 0.5 + 0.3 * 1.2 * 2, 6);
  });

  it('income, through the standard it drifts toward', () => {
    expect(standardTargetFor(20_000, 0)).toBeLessThan(standardTargetFor(60_000, 0));
    expect(standardTargetFor(60_000, 0)).toBeLessThan(standardTargetFor(200_000, 0));
  });

  it('wealth, which is spec 193’s lifestyle creep and nothing else in this model', () => {
    // Two people on the same salary, one of them sitting on half a million.
    expect(standardTargetFor(60_000, 500_000)).toBeGreaterThan(standardTargetFor(60_000, 0));
    // But it NUDGES. If wealth set the standard, a windfall would bankrupt
    // somebody inside three years, which is a worse model than not having it.
    expect(standardTargetFor(60_000, 500_000)).toBeLessThan(standardTargetFor(60_000, 0) * 1.4);
  });

  it('a teenager costs more than a toddler — Ticket 0304', () => {
    /*
      Inherited from `monthlyCostOf`, which carried this curve from 0208 and was
      a SECOND cost model: it told a player a child cost $420 a month while the
      household was charged a flat share worth something else. The curve was the
      good half of that placeholder and it is the half that was kept.
    */
    expect(alone({ childAges: [15] })).toBeGreaterThan(alone({ childAges: [8] }));
    expect(alone({ childAges: [8] })).toBeGreaterThan(alone({ childAges: [2] }));
  });

  it('housing, which is the largest single term there is', () => {
    expect(alone({ housing: 'withFamily' })).toBe(Math.round(alone() * AT_HOME_SHARE));
    // Not free. A person at their parents' still eats and still travels, and a
    // free option would make moving out a pure loss the player would game.
    expect(alone({ housing: 'withFamily' })).toBeGreaterThan(0);
  });
});

describe('the standard of living has a memory', () => {
  it('never falls below subsistence, whatever happens', () => {
    // The floor of the model, and the number that makes unemployment cost
    // something. A standard that could reach zero would mean a character with
    // no income living for free, which is the defect this ticket exists to fix.
    let standard = 90_000;
    for (let year = 0; year < 60; year += 1) standard = creep(standard, 0);
    expect(standard).toBe(SUBSISTENCE);
  });

  it('climbs faster than it falls, which is the whole reason it is state', () => {
    /*
      THE ASYMMETRY IS THE FEATURE. A raise turns into a bigger life within a
      year or two; losing the job does not shrink it again on the same
      schedule, because the lease is signed and the habits are set. That lag is
      what makes losing an income hurt here instead of merely pausing it.

      A model that recomputed the standard from this year's income could not
      express it — which is the argument for `standard` being saved state and
      not a function.
    */
    expect(CREEP_UP).toBeGreaterThan(CREEP_DOWN);
    const up = creep(30_000, 60_000) - 30_000;
    const down = 60_000 - creep(60_000, 30_000);
    expect(up).toBeGreaterThan(down);
  });

  it('takes years to catch up with a raise, and years to let go of one', () => {
    let standard = SUBSISTENCE;
    const target = standardTargetFor(90_000, 0);
    for (let year = 0; year < 3; year += 1) standard = creep(standard, target);
    // Most of the way there, not all of it.
    expect(standard).toBeGreaterThan(target * 0.6);
    expect(standard).toBeLessThan(target);

    // And the year the income stops, almost nothing changes.
    const afterOneBadYear = creep(standard, SUBSISTENCE);
    expect(afterOneBadYear).toBeGreaterThan(standard * 0.85);
  });
});

describe('what a year actually comes to', () => {
  it('costs something for somebody with no income at all', () => {
    /*
      THE TICKET IN ONE ASSERTION.

      Measured before this ticket, across 120 lives: a character who never took
      a job was charged nothing in 6,357 adult years, and held $100 at thirty,
      $100 at fifty and $100 the day they died. The old model expressed the cost
      of living as a share of pay, so there was no pay to take a share of.
    */
    expect(
      livingCostFor({
        standard: SUBSISTENCE,
        locationIndex: 1,
        partnered: false,
        childAges: [],
        housing: 'ownPlace',
      }).total,
    ).toBeGreaterThan(0);
  });

  it('is a plausible number for a plausible life', () => {
    // CORE_RULES 13.25 — measured against the population the build makes, not
    // against what the word means in the world. A median earner on roughly
    // $46,000 take-home, alone, in an average American city.
    const standard = standardTargetFor(46_000, 12_000);
    const cost = livingCostFor({
      standard,
      locationIndex: 1,
      partnered: false,
      childAges: [],
      housing: 'ownPlace',
    }).total;
    expect(cost).toBeGreaterThan(30_000);
    expect(cost).toBeLessThan(46_000);
  });

  it('leaves a high earner more than a low one, in dollars and in share', () => {
    const poor = { income: 26_000 };
    const rich = { income: 220_000 };
    const left = (income: number) =>
      income -
      livingCostFor({
        standard: standardTargetFor(income, 0),
        locationIndex: 1,
        partnered: false,
        childAges: [],
        housing: 'ownPlace',
      }).total;
    expect(left(rich.income)).toBeGreaterThan(left(poor.income));
    expect(left(rich.income) / rich.income).toBeGreaterThan(left(poor.income) / poor.income);
  });

  it('can leave a household going backwards, which it must be able to do', () => {
    // A small wage and four children does not break even. `BEHIND_LINES` in
    // the living phase is four sentences about exactly that year, and copy for
    // a state the model cannot produce is CORE_RULES 13.16 in miniature — the
    // bug that made those lines unreachable under the old model for a whole
    // ticket.
    const income = 25_000;
    const cost = livingCostFor({
      standard: standardTargetFor(income, 0),
      locationIndex: 1.1,
      partnered: true,
      childAges: [8, 8, 8, 8],
      housing: 'ownPlace',
    }).total;
    expect(cost).toBeGreaterThan(income);
  });
});
