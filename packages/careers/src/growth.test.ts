/**
 * Ticket 0411 acceptance tests — the model, asserted where it lives.
 *
 * The population half is in `packages/simulation/src/development.test.ts`. This
 * file asserts the pure function, because a claim about a curve is cheaper and
 * sharper to make against the curve than against sixty played lives — 0409's
 * lesson about asserting a predicate where it lives rather than where it shows.
 */

import { describe, expect, it } from 'vitest';
import {
  APT_ORDINARY,
  APT_STRONG,
  GROWTH_STATS,
  LEARNS_MORE,
  LEARNS_NOTHING,
  NEGLECT_AFTER,
  RUSTY_FLOOR,
  STILL_LEARNING,
  TRACK_WANTS,
  USED,
  idleYearDrift,
  workYearGrowth,
} from './index';

const ORDINARY = {
  smarts: 60,
  discipline: 60,
  charisma: 60,
  performance: 70,
  years: 1,
} as const;

describe('0411 — what a year of work is worth', () => {
  it('grows what the track hires for, and lets the rest go', () => {
    /*
      THE WHOLE TICKET IN ONE ASSERTION. `TRACK_WANTS` is the table `hireChance`
      reads; the claim is that what a track wants when it hires is what it builds
      in you. Logistics wants steadiness and nothing else (0.34 / 0.06 / 0.04);
      tech wants head work and nothing else (0.06 / 0.34 / 0.04).
    */
    const driving = workYearGrowth({ ...ORDINARY, track: 'logistics', years: NEGLECT_AFTER });
    expect(driving.discipline, 'a logistics year must build steadiness').toBeGreaterThan(0);
    expect(driving.smarts ?? 0, 'and let the head work go').toBeLessThan(0);

    const coding = workYearGrowth({ ...ORDINARY, track: 'tech', years: NEGLECT_AFTER });
    expect(coding.smarts, 'a tech year must build head work').toBeGreaterThan(0);
    expect(coding.discipline ?? 0, 'and let the steadiness go').toBeLessThan(0);
    expect(coding.charisma ?? 0, 'and the people skills with it').toBeLessThan(0);
  });

  it('develops the whole person in the one job that asks for all three', () => {
    // Care is the only row in the table that wants every stat at or above `USED`
    // — 0.16 / 0.12 / 0.16 — and that is both what the table says and true.
    const wants = TRACK_WANTS.care;
    const asked = GROWTH_STATS.filter((stat) => wants[stat] >= USED);
    expect(asked.length, 'care should want more than one thing').toBeGreaterThan(1);

    const year = workYearGrowth({ ...ORDINARY, track: 'care', years: NEGLECT_AFTER });
    for (const stat of asked) {
      expect(year[stat] ?? 0, `care should build ${stat}`).toBeGreaterThan(0);
    }
    // And nothing it asks for is allowed to drift while it is asking for it.
    for (const stat of asked) expect(year[stat] ?? 0).not.toBeLessThan(0);
  });

  it('teaches nothing in a year the character coasted through', () => {
    const coasted = workYearGrowth({
      ...ORDINARY,
      track: 'logistics',
      performance: LEARNS_NOTHING - 1,
    });
    expect(coasted.discipline ?? 0).toBeLessThanOrEqual(0);
    const tried = workYearGrowth({ ...ORDINARY, track: 'logistics', performance: LEARNS_MORE });
    expect(tried.discipline ?? 0).toBeGreaterThan(0);
  });

  it('is worth more early and nothing once somebody has plateaued', () => {
    const first = workYearGrowth({ ...ORDINARY, track: 'tech', years: 1 }).smarts ?? 0;
    const sixth = workYearGrowth({ ...ORDINARY, track: 'tech', years: 6 }).smarts ?? 0;
    const twentieth =
      workYearGrowth({ ...ORDINARY, track: 'tech', years: STILL_LEARNING + 1 }).smarts ?? 0;
    expect(first).toBeGreaterThan(0);
    expect(sixth).toBeLessThanOrEqual(first);
    expect(twentieth, 'a twentieth year in the same chair teaches nothing').toBe(0);
  });

  it('does not hand the same gain to everybody, which is what flattened school', () => {
    /*
      CORE_RULES 13.66, read as a warning rather than a finding. 0408 measured
      what a flat push through `curvedDelta` does over thirteen years: it hands
      its biggest gains to whoever can use them least and ends with a population
      that has no bottom. A working life is forty years of the same shape, so the
      step is banded on aptitude and the bottom band has to earn it.
    */
    const strong = workYearGrowth({
      ...ORDINARY,
      track: 'tech',
      smarts: APT_STRONG + 5,
      performance: LEARNS_MORE,
    }).smarts;
    const weakOrdinaryYear = workYearGrowth({
      ...ORDINARY,
      track: 'tech',
      smarts: APT_ORDINARY - 10,
      performance: LEARNS_MORE - 1,
    }).smarts;
    expect(strong ?? 0).toBeGreaterThan(0);
    expect(weakOrdinaryYear ?? 0, 'weak at it and an ordinary year moves nothing').toBe(0);
  });

  it('stops being rusty rather than becoming incapable', () => {
    const rusty = workYearGrowth({
      ...ORDINARY,
      track: 'tech',
      charisma: RUSTY_FLOOR,
      years: NEGLECT_AFTER + 2,
    });
    expect(rusty.charisma ?? 0, 'at the floor the drift stops').toBe(0);
  });

  it('charges a second idle year and not a first', () => {
    // 0407 made unemployment reachable and it only ever cost money.
    expect(idleYearDrift(70, 1)).toEqual({});
    expect(idleYearDrift(70, 2).discipline ?? 0).toBeLessThan(0);
    expect(idleYearDrift(RUSTY_FLOOR, 9), 'floored like neglect').toEqual({});
  });
});
