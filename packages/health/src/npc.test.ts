/**
 * Ticket 0212 — the NPC body.
 *
 * Two things matter here and nothing else does: the closed form must equal the
 * accumulation it replaces, and the resulting lifespan has to be a human one.
 */
import { describe, expect, it } from 'vitest';
import { ageingLoss, DECLINE_STARTS } from './aging';
import {
  CHILD_SAFE_UNTIL,
  cumulativeAgeingLoss,
  npcDeathChance,
  npcHealthAt,
  npcPeakHealth,
} from './npc';

describe('cumulativeAgeingLoss', () => {
  it('equals a year-by-year accumulation of ageingLoss', () => {
    // The whole risk of a closed form is that it drifts from the thing it is a
    // closed form OF. So this asserts against the accumulation, not against
    // numbers somebody wrote down once.
    let running = 0;
    for (let age = DECLINE_STARTS; age <= 100; age += 1) {
      running += ageingLoss(age);
      expect(cumulativeAgeingLoss(age + 1), `age ${age + 1}`).toBeCloseTo(running, 6);
    }
  });

  it('is zero for anybody still young', () => {
    for (let age = 0; age <= DECLINE_STARTS; age += 1) {
      expect(cumulativeAgeingLoss(age)).toBe(0);
    }
  });
});

describe('npc mortality', () => {
  it('never takes a child', () => {
    for (let age = 0; age < CHILD_SAFE_UNTIL; age += 1) {
      expect(npcDeathChance(0, age)).toBe(0);
      expect(npcDeathChance(1, age)).toBe(0);
    }
  });

  it('climbs with age and falls with constitution', () => {
    expect(npcDeathChance(0.5, 80)).toBeGreaterThan(npcDeathChance(0.5, 60));
    expect(npcDeathChance(0.9, 80)).toBeLessThan(npcDeathChance(0.1, 80));
  });

  it('gives a human lifespan, measured rather than asserted', () => {
    // Walk the curve for a thousand people and see where they actually land.
    // CORE_RULES 13.25: the number that matters is the one the model produces.
    const ages: number[] = [];
    for (let i = 0; i < 1000; i += 1) {
      const constitution = (i + 0.5) / 1000;
      let survival = 1;
      let expected = 0;
      for (let age = CHILD_SAFE_UNTIL; age <= 115; age += 1) {
        const chance = npcDeathChance(constitution, age);
        expected += survival * chance * age;
        survival *= 1 - chance;
      }
      ages.push(expected + survival * 115);
    }
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const sorted = [...ages].sort((a, b) => a - b);
    // A person who reaches eighteen should expect to see their seventies, and
    // constitution should be worth a real number of years rather than a rounding
    // error. Wide bounds on purpose: this is a guard against the model going
    // obviously wrong, not a pin on a tuned constant.
    expect(mean, `mean ${mean.toFixed(1)}`).toBeGreaterThan(70);
    expect(mean, `mean ${mean.toFixed(1)}`).toBeLessThan(82);
    // The first range shipped in this file gave a spread of 4.9 years, which
    // means constitution did not exist. This is the guard against that.
    const spread = (sorted[900] ?? 0) - (sorted[100] ?? 0);
    expect(spread, `spread ${spread.toFixed(1)}`).toBeGreaterThan(8);
  });

  it('derives health from the peak and never goes below one', () => {
    expect(npcHealthAt(0.5, 20)).toBeCloseTo(npcPeakHealth(0.5), 6);
    expect(npcHealthAt(0, 130)).toBeGreaterThanOrEqual(1);
  });
});
