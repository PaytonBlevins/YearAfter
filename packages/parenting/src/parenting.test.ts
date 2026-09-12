/**
 * Ticket 0208 acceptance tests.
 *
 * The first block is the same kind of rule Ticket 0207's age gate is, and it
 * must never be relaxed to make a balance test pass: nothing in this system
 * exists below `PARENT_AGE`, through any function, at any value.
 *
 * The rest hold the fertility curve to the shape it was measured into. The
 * bounds are loose on purpose — they exist to catch the curve going flat or
 * running away, not to pin a number somebody will want to tune.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality } from '@yearafter/character';
import { asNpcId, dollars } from '@yearafter/core';
import type { FamilyMember, Household } from '@yearafter/relationships';
import {
  APPLICATION_FEE,
  ASK_CHANCE,
  CHILD_ASKS,
  DISTANT,
  SETTLES_AT,
  FERTILITY_ENDS,
  GESTATION_YEARS,
  PARENT_AGE,
  adultChildren,
  ageOnArrival,
  asksFor,
  askCost,
  canApply,
  feeFor,
  canBecomeParent,
  childPersonality,
  childrenAtHome,
  closenessYear,
  conceptionChance,
  fertility,
  isDue,
  isWaiting,
  milestoneFor,
  placementChance,
} from './index';

const kid = (id: string, birthYear: number, alive = true): FamilyMember => ({
  id: asNpcId(id),
  role: 'child',
  firstName: id,
  lastName: 'Okonjo',
  sex: 'female',
  birthYear,
  alive,
  tier: 1,
  personality: createPersonality(),
  relationship: 80,
  arrivedBy: 'birth',
});

const houseWith = (members: FamilyMember[]): Household => ({
  members,
  finances: { band: 'modest', annualIncome: dollars(50_000) },
});

/* -------------------------------------------------------------------------- */
/* The age gate                                                                */
/* -------------------------------------------------------------------------- */

describe('nobody under eighteen becomes a parent', () => {
  it('has no fertility at all below the age', () => {
    for (let age = 0; age < PARENT_AGE; age += 1) {
      expect(canBecomeParent(age), `age ${age}`).toBe(false);
      expect(fertility(age), `age ${age}`).toBe(0);
      expect(conceptionChance(age, 0), `age ${age}`).toBe(0);
      // Not even with the whole rest of the model at its most generous.
      expect(conceptionChance(age, 0)).toBe(0);
    }
  });

  it('cannot adopt below the age, with any amount of money', () => {
    for (let age = 0; age < PARENT_AGE; age += 1) {
      expect(canApply(age, 100_000_000, undefined), `age ${age}`).toBe(false);
    }
  });

  it('opens at eighteen and not before', () => {
    expect(fertility(PARENT_AGE - 1)).toBe(0);
    expect(fertility(PARENT_AGE)).toBeGreaterThan(0);
    expect(canApply(PARENT_AGE, APPLICATION_FEE, undefined)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Fertility                                                                   */
/* -------------------------------------------------------------------------- */

describe('the fertility curve', () => {
  it('is flat through the twenties and falls after', () => {
    expect(fertility(22)).toBe(fertility(28));
    expect(fertility(32)).toBeLessThan(fertility(28));
    expect(fertility(40)).toBeLessThan(fertility(32));
    expect(fertility(44)).toBeLessThan(fertility(40));
  });

  it('ends, rather than tailing off forever', () => {
    expect(fertility(FERTILITY_ENDS)).toBe(0);
    expect(fertility(FERTILITY_ENDS + 20)).toBe(0);
  });

  it('never has a cliff at a single birthday', () => {
    // A year that halves your chances would be a rule the player learns rather
    // than a life they are living.
    for (let age = PARENT_AGE + 1; age < FERTILITY_ENDS; age += 1) {
      const drop = fertility(age - 1) - fertility(age);
      expect(drop, `between ${age - 1} and ${age}`).toBeLessThan(0.09);
    }
  });

  it('makes each child after the first harder', () => {
    expect(conceptionChance(28, 3)).toBeLessThan(conceptionChance(28, 0));
    expect(conceptionChance(28, 6)).toBeLessThan(conceptionChance(28, 3));
  });

  it('never closes the door entirely while the curve is open', () => {
    expect(conceptionChance(28, 20)).toBeGreaterThan(0);
  });

  it('makes leaving it late cost something real', () => {
    // The measurement the constants were set from: four years of trying at 38
    // comes away with nothing about a quarter of the time, and at 28 rarely.
    const tries = (start: number, years: number, seedBase: number) => {
      let none = 0;
      const runs = 4000;
      for (let run = 0; run < runs; run += 1) {
        let kids = 0;
        let waiting = 0;
        // Deterministic pseudo-draws, so the test does not flake.
        let x = (seedBase + run) * 2654435761;
        const next = () => {
          x = (x ^ (x >>> 15)) * 2246822519;
          x = (x ^ (x >>> 13)) * 3266489917;
          return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
        };
        for (let age = start; age < start + years; age += 1) {
          if (waiting > 0) {
            waiting -= 1;
            if (waiting === 0) kids += 1;
            continue;
          }
          if (next() < conceptionChance(age, kids)) waiting = GESTATION_YEARS;
        }
        if (kids === 0) none += 1;
      }
      return none / runs;
    };
    const young = tries(28, 4, 11);
    const late = tries(38, 4, 12);
    expect(late).toBeGreaterThan(young);
    expect(late).toBeGreaterThan(0.15);
    expect(young).toBeLessThan(0.3);
  });
});

describe('a pregnancy takes a year', () => {
  it('is not due the year it starts', () => {
    expect(isDue({ since: 30 }, 30)).toBe(false);
    expect(isDue({ since: 30 }, 31)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* What a child costs and how they do                                          */
/* -------------------------------------------------------------------------- */

/*
  What a child costs moved to `@yearafter/finance` in Ticket 0304, and the tests
  went with it (`living.test.ts`, "a teenager costs more than a toddler").

  It was here because 0208 needed a number for the child's page before any
  ledger existed. By 0304 it had become a second cost model disagreeing with the
  one that actually bills the household, which is the thing CORE_RULES 13.23 is
  about — so it is gone rather than kept alongside.
*/

describe('closeness', () => {
  it('rises when the player says yes and falls when they say no', () => {
    expect(closenessYear(60, 'answered', 8)).toBeGreaterThan(60);
    expect(closenessYear(60, 'refused', 8)).toBeLessThan(60);
  });

  it('does not call "nobody asked you for anything" neglect', () => {
    // The defect this encodes: with only answered/not-answered, a parent of
    // four who said yes to EVERY ask still watched every child drift, because
    // asks arrive about once a year across the whole family. Measured, a player
    // doing everything the game offered ended at a mean closeness of 51 and
    // falling. A parent who had no opportunity did not miss one.
    const quietYear = closenessYear(SETTLES_AT, 'nothing-asked', 8);
    expect(quietYear).toBe(SETTLES_AT);
  });

  it('settles towards the middle from either side in a quiet year', () => {
    expect(closenessYear(95, 'nothing-asked', 8)).toBeLessThan(95);
    expect(closenessYear(20, 'nothing-asked', 8)).toBeGreaterThan(20);
  });

  it('lets a teenager pull away without it being the parent’s fault', () => {
    const answered = closenessYear(80, 'answered', 14);
    expect(answered).toBeGreaterThan(80 - 1);
    expect(answered).toBeLessThan(closenessYear(80, 'answered', 8));
  });

  it('can reach a distance a parent would notice, if they keep saying no', () => {
    let warmth = 80;
    for (let year = 0; year < 12; year += 1) warmth = closenessYear(warmth, 'refused', 10 + year);
    expect(warmth).toBeLessThan(DISTANT);
  });

  it('never leaves the 0-100 range', () => {
    let high = 100;
    let low = 0;
    for (let year = 0; year < 30; year += 1) {
      high = closenessYear(high, 'answered', 8);
      low = closenessYear(low, 'refused', 8);
    }
    expect(high).toBeLessThanOrEqual(100);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

/* -------------------------------------------------------------------------- */
/* What a child asks for (spec 61, spec 1147)                                  */
/* -------------------------------------------------------------------------- */

describe('children ask, parents answer', () => {
  it('offers nothing to a baby and something to a ten-year-old', () => {
    expect(asksFor(2)).toEqual([]);
    expect(asksFor(10).length).toBeGreaterThan(4);
  });

  it('stops asking once they are grown', () => {
    expect(asksFor(18)).toEqual([]);
  });

  it('prices everything, because saying yes has to cost something', () => {
    for (const ask of CHILD_ASKS) {
      expect(ask.cost, ask.id).toBeGreaterThan(0);
      expect(ask.wants.length, ask.id).toBeGreaterThan(8);
      // Reads as the child's own words inside "…wants {wants}."
      expect(ask.wants.startsWith('to ') || ask.wants.startsWith('a '), ask.id).toBe(true);
    }
  });

  it('does not ask every single year', () => {
    // A child who asks every year for twelve years is a subscription, not a
    // person (spec 1986 abstracts the ordinary business of raising one).
    expect(ASK_CHANCE).toBeLessThan(0.6);
  });
});

/* -------------------------------------------------------------------------- */
/* Milestones and the roster                                                   */
/* -------------------------------------------------------------------------- */

describe('growing up', () => {
  it('marks the ages that are actually something, and no others', () => {
    expect(milestoneFor(0, 'Ada', 0.5)).toBeTruthy();
    expect(milestoneFor(5, 'Ada', 0.5)).toBeTruthy();
    expect(milestoneFor(13, 'Ada', 0.5)).toBeTruthy();
    // Not every birthday, or three children produce three lines a year forever.
    expect(milestoneFor(2, 'Ada', 0.5)).toBeUndefined();
    expect(milestoneFor(7, 'Ada', 0.5)).toBeUndefined();
    expect(milestoneFor(30, 'Ada', 0.5)).toBeUndefined();
  });

  it('always names the child and never leaves a token', () => {
    for (let age = 0; age <= 20; age += 1) {
      for (const roll of [0, 0.4, 0.99]) {
        const line = milestoneFor(age, 'Ada', roll);
        if (!line) continue;
        expect(line).toContain('Ada');
        expect(line).not.toContain('{');
      }
    }
  });

  it('separates children at home from grown ones', () => {
    const house = houseWith([kid('young', 2015), kid('grown', 2000), kid('gone', 1998, false)]);
    expect(childrenAtHome(house, 2025).map((c) => c.firstName)).toEqual(['young']);
    expect(adultChildren(house, 2025).map((c) => c.firstName)).toEqual(['grown']);
  });
});

describe('who a child turns out to be', () => {
  const draw = (key: string) => (key.length % 7) / 7;

  it('is not simply the average of its parents', () => {
    const mine = createPersonality({ ambition: 90, loyalty: 90, temper: 10 });
    const theirs = createPersonality({ ambition: 90, loyalty: 90, temper: 10 });
    const child = childPersonality(mine, theirs, draw);
    const identical = Object.keys(mine).every(
      (key) => child[key as keyof typeof child] === mine[key as keyof typeof mine],
    );
    expect(identical).toBe(false);
  });

  it('works for a single parent', () => {
    const child = childPersonality(createPersonality(), undefined, draw);
    for (const value of Object.values(child)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Adoption                                                                    */
/* -------------------------------------------------------------------------- */

describe('adoption', () => {
  it('refuses a second application while one is open', () => {
    expect(canApply(30, APPLICATION_FEE, undefined)).toBe(true);
    expect(canApply(30, 10_000_000, { appliedAtAge: 29 })).toBe(false);
  });

  it('is not priced out of reach of somebody with nothing', () => {
    // CORE_RULES 13.16. A flat fee is a dependency on Ticket 0210, and measuring
    // 90 played families found adoption reached zero times because nobody has
    // an income yet — closing the one route that does not need a partner.
    expect(canApply(30, 0, undefined)).toBe(true);
    expect(feeFor(0)).toBe(0);
    expect(feeFor(50_000)).toBe(50_000);
    expect(feeFor(10_000_000)).toBe(APPLICATION_FEE);
  });

  it('never charges more than the character is holding', () => {
    for (const cash of [0, 1, 99_999, APPLICATION_FEE, 9_000_000]) {
      expect(feeFor(cash)).toBeLessThanOrEqual(cash);
      expect(feeFor(cash)).toBeLessThanOrEqual(APPLICATION_FEE);
    }
  });

  it('never charges a parent more for an ask than they are holding', () => {
    for (const ask of CHILD_ASKS) {
      for (const cash of [0, 500, ask.cost - 1, ask.cost, 9_000_000]) {
        expect(askCost(ask.cost, cash)).toBeLessThanOrEqual(Math.max(0, cash));
        expect(askCost(ask.cost, cash)).toBeLessThanOrEqual(ask.cost);
      }
    }
  });

  it('lets somebody apply again once the last one closed', () => {
    expect(canApply(34, 10_000_000, { appliedAtAge: 29, placedAtAge: 31 })).toBe(true);
    expect(canApply(34, 10_000_000, { appliedAtAge: 29, withdrawnAtAge: 30 })).toBe(true);
    expect(isWaiting({ appliedAtAge: 29, placedAtAge: 31 })).toBe(false);
  });

  it('never places in the first year, and always places eventually', () => {
    expect(placementChance(0)).toBe(0);
    expect(placementChance(1)).toBeGreaterThan(0);
    expect(placementChance(4)).toBe(1);
  });

  it('does not quietly mean "newborn"', () => {
    // Older children are the ones who actually wait for placements. A game
    // where adoption always produced a baby would be saying something untrue.
    const ages = [0, 0.2, 0.4, 0.5, 0.7, 0.8, 0.9, 0.99].map(ageOnArrival);
    expect(Math.max(...ages)).toBeGreaterThan(4);
    expect(Math.min(...ages)).toBe(0);
    for (const age of ages) {
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(PARENT_AGE);
    }
  });
});
