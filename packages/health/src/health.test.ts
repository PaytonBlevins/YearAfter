/**
 * Ticket 0211 — the model in the small.
 *
 * `packages/simulation/src/health.test.ts` plays 150 lives and asserts the shape
 * of the population that comes out. This asserts the properties that must hold
 * for any input at all, which is the half a played population cannot cover: a
 * curve is easy to tune into looking right at the median and still be wrong at
 * the edges.
 */

import { describe, expect, it } from 'vitest';
import { PEAK_AGE, ageingLoss, cumulativeAgeingLoss } from './aging';
import { CONDITIONS, ceilingWith, findCondition, hazardWith, HAZARD_CAP } from './conditions';
import {
  HEAL_SHARE,
  HEALTHY_ADULT,
  INJURY_ATHLETE,
  INJURY_HAZARDOUS,
  INJURY_ORDINARY,
  DOUBLES_EVERY,
  MORTALITY_AT_60,
  SUDDEN,
  deathChance,
  frailtyFactor,
  ROBUST_FLOOR,
  illnessChance,
  injuryChance,
  RECOVERY_BASE,
  TYPICAL_PEAK,
  constitutionOf,
  naturalRecovery,
  severityOpenness,
} from './health';
import { runHealthYear } from './year';

describe('the age curve', () => {
  it('gives before the peak and takes after it, and never reverses', () => {
    for (let age = 0; age < PEAK_AGE; age += 1) {
      expect(ageingLoss(age), `age ${age}`).toBeLessThan(0);
    }
    let previous = -Infinity;
    for (let age = PEAK_AGE; age < 110; age += 1) {
      const loss = ageingLoss(age);
      expect(loss, `age ${age}`).toBeGreaterThanOrEqual(previous);
      previous = loss;
    }
  });

  it('costs an eighty-year-old more than a forty-year-old', () => {
    expect(ageingLoss(80)).toBeGreaterThan(ageingLoss(40));
  });
});

describe('mortality', () => {
  it('almost never takes a healthy young adult — spec 559', () => {
    // The hard constraint on every constant in the curve. A healthy
    // twenty-five-year-old must be able to play a whole decade and expect
    // nothing, or the game has taught the player that nothing they do matters.
    const risk = deathChance({ age: 25, health: 80, conditions: [] });
    expect(risk).toBeLessThan(0.001);
    const overADecade = 1 - (1 - risk) ** 10;
    expect(overADecade, `${(overADecade * 100).toFixed(2)}% over a decade`).toBeLessThan(0.01);
  });

  it('never returns zero, because sudden death exists', () => {
    // Setting the floor to zero would be a different lie from setting it high.
    expect(deathChance({ age: 20, health: 100, conditions: [] })).toBeGreaterThanOrEqual(SUDDEN);
  });

  it('climbs with age, monotonically, for the same body', () => {
    let previous = 0;
    for (let age = 20; age <= 105; age += 1) {
      const risk = deathChance({ age, health: 60, conditions: [] });
      expect(risk, `age ${age}`).toBeGreaterThanOrEqual(previous);
      previous = risk;
    }
  });

  it('makes a strong body worth something and a failing one worth much less', () => {
    /*
      THIS TEST USED TO ASSERT THE OTHER SHAPE (Ticket 0408), and it was right
      to. It was called "treats being well as the baseline rather than a bonus"
      and pinned `frailtyFactor(100) === 1`, which was the deliberate design
      while the population had nothing above the baseline to measure: birth
      health ran p10 45 / p90 69 and nobody was meaningfully robust.

      0408 widened the roll and the one-sidedness became the finding instead.
      Across a sixty-eight point range of birth health, median age at death
      moved four years — the same "another way of saying constitution did not
      exist" that 0212 recorded for NPCs and fixed only for them. A multiplier
      that cannot go below one can say "this body is failing" and cannot say
      "this body is unusually good". CORE_RULES 13.65.

      What has to stay true is the shape: a baseline at the healthy adult mark,
      a bounded gain above it, and a much steeper penalty below.
    */
    expect(frailtyFactor(HEALTHY_ADULT)).toBe(1);
    expect(frailtyFactor(100)).toBe(ROBUST_FLOOR);
    expect(frailtyFactor(100)).toBeLessThan(1);
    expect(frailtyFactor(HEALTHY_ADULT + 10)).toBeLessThan(1);
    expect(frailtyFactor(HEALTHY_ADULT + 10)).toBeGreaterThan(ROBUST_FLOOR);
    expect(frailtyFactor(HEALTHY_ADULT - 20)).toBeGreaterThan(1);

    // The penalty side is still the steeper one, on purpose: being frail costs
    // far more than being robust pays.
    expect(frailtyFactor(HEALTHY_ADULT - 20) - 1).toBeGreaterThan(1 - frailtyFactor(100));
  });

  it('keeps the sudden-death floor out of reach of a good constitution', () => {
    // Robustness buys odds against what accumulates, not against accidents.
    expect(deathChance({ age: 20, health: 100, conditions: [] })).toBeGreaterThanOrEqual(SUDDEN);
    expect(deathChance({ age: 20, health: 62, conditions: [] })).toBeGreaterThanOrEqual(SUDDEN);
  });

  it('is bounded, so a collection of conditions is trouble and not arithmetic doom', () => {
    const everything = CONDITIONS.map((condition) => ({
      conditionId: condition.id,
      since: 40,
      treated: false,
    }));
    expect(hazardWith(everything)).toBeLessThanOrEqual(HAZARD_CAP);
    expect(deathChance({ age: 95, health: 0, conditions: everything })).toBeLessThanOrEqual(0.97);
  });
});

describe('conditions', () => {
  it('has a ceiling and a hazard on every entry, and unique ids', () => {
    const ids = CONDITIONS.map((condition) => condition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const condition of CONDITIONS) {
      expect(condition.ceiling, condition.id).toBeGreaterThan(0);
      expect(condition.ceiling, condition.id).toBeLessThanOrEqual(100);
      expect(condition.hazard, condition.id).toBeGreaterThanOrEqual(1);
      expect(condition.treatable, condition.id).toBeGreaterThanOrEqual(0);
      expect(findCondition(condition.id)).toBe(condition);
    }
  });

  it('makes something grave worse than something minor, on both axes', () => {
    const grave = CONDITIONS.filter((c) => c.severity === 'grave');
    const minor = CONDITIONS.filter((c) => c.severity === 'minor');
    const worst = Math.min(...grave.map((c) => c.ceiling));
    const best = Math.min(...minor.map((c) => c.ceiling));
    expect(worst).toBeLessThan(best);
    expect(Math.max(...grave.map((c) => c.hazard))).toBeGreaterThan(
      Math.max(...minor.map((c) => c.hazard)),
    );
  });

  it('takes the LOWEST ceiling rather than stacking them', () => {
    // Two bad knees is not half a person. The worst thing wrong with you is
    // what decides how well you can be.
    const two = [
      { conditionId: 'cond.knee', since: 30, treated: false },
      { conditionId: 'cond.back', since: 30, treated: false },
    ];
    expect(ceilingWith(two)).toBe(
      Math.min(findCondition('cond.knee')!.ceiling, findCondition('cond.back')!.ceiling),
    );
  });

  it('closes grave conditions off to the young and opens them to the old', () => {
    expect(severityOpenness(30)).toBe(0);
    expect(severityOpenness(45)).toBe(0);
    expect(severityOpenness(70)).toBe(1);
    expect(severityOpenness(56)).toBeGreaterThan(0);
    expect(severityOpenness(56)).toBeLessThan(1);
  });
});

describe('injury frequency — spec 541-543', () => {
  it('is ordered athlete, then hazardous work, then everybody else', () => {
    expect(injuryChance({ athlete: true, hazardous: false })).toBe(INJURY_ATHLETE);
    expect(injuryChance({ athlete: false, hazardous: true })).toBe(INJURY_HAZARDOUS);
    expect(injuryChance({ athlete: false, hazardous: false })).toBe(INJURY_ORDINARY);
    expect(INJURY_ATHLETE).toBeGreaterThan(INJURY_HAZARDOUS);
    expect(INJURY_HAZARDOUS).toBeGreaterThan(INJURY_ORDINARY);
  });

  it('keeps even the athlete rate rare — "still not overly frequent"', () => {
    expect(INJURY_ATHLETE).toBeLessThan(0.06);
  });

  it('puts an athlete first even when they also work a hazardous job', () => {
    expect(injuryChance({ athlete: true, hazardous: true })).toBe(INJURY_ATHLETE);
  });
});

describe('a year', () => {
  const quiet = (over: Partial<Parameters<typeof runHealthYear>[0]> = {}) =>
    runHealthYear({
      age: 40,
      vitality: 70,
      deficit: 0,
      stress: 10,
      conditions: [],
      athlete: false,
      hazardous: false,
      recovery: 3,
      // Every draw at 0.99: nothing fires, nobody dies.
      draw: () => 0.99,
      ...over,
    });

  it('leaves a quiet year alone apart from ageing', () => {
    const result = quiet();
    expect(result.alive).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.vitality).toBeLessThan(70);
    expect(result.conditions).toEqual([]);
  });

  it('heals a deficit toward zero rather than forever', () => {
    const result = quiet({ deficit: 2, recovery: 10 });
    expect(result.deficit).toBe(0);
    // And health never climbs above the age curve because of it.
    expect(result.health).toBeLessThanOrEqual(Math.round(result.vitality));
  });

  it('never lets health exceed the worst condition ceiling', () => {
    const held = [{ conditionId: 'cond.stroke', since: 40, treated: false }];
    const result = quiet({ vitality: 95, conditions: held });
    expect(result.health).toBeLessThanOrEqual(findCondition('cond.stroke')!.ceiling);
  });

  it('spends draws in a fixed order, so a quiet year and a bad one cost the same', () => {
    // The property that keeps a life replaying from its seed. Both of these
    // read from the same fixed block; neither may read past it.
    const reads: number[] = [];
    runHealthYear({
      age: 60,
      vitality: 55,
      deficit: 0,
      stress: 40,
      conditions: [{ conditionId: 'cond.blood', since: 55, treated: true }],
      athlete: true,
      hazardous: false,
      recovery: 3,
      draw: (index) => {
        reads.push(index);
        return 0.001;
      },
    });
    expect(Math.max(...reads)).toBeLessThan(24);
    // Read in ascending order, never twice for the same slot.
    expect(new Set(reads).size).toBe(reads.length);
  });

  it('kills, and says what of', () => {
    const result = quiet({ age: 90, vitality: 20, draw: () => 0.0001 });
    expect(result.alive).toBe(false);
    const died = result.events.find((event) => event.kind === 'died');
    expect(died).toBeDefined();
    if (died?.kind === 'died') expect(died.cause.length).toBeGreaterThan(3);
  });

  it('names the worst thing wrong with them on the certificate', () => {
    const result = quiet({
      age: 70,
      vitality: 30,
      conditions: [
        { conditionId: 'cond.knee', since: 40, treated: false },
        { conditionId: 'cond.growth', since: 68, treated: false },
      ],
      // Nothing clears (slots 8 and 9 read high), and the death roll — the
      // slot after them — reads low. Clearing is checked BEFORE the death roll
      // on purpose: a condition that resolved this year is not what killed you.
      draw: (index) => (index >= 10 ? 0.0001 : 0.99),
    });
    const died = result.events.find((event) => event.kind === 'died');
    expect(died, 'the year should have ended it').toBeDefined();
    if (died?.kind === 'died') {
      expect(died.cause).toBe(findCondition('cond.growth')!.label);
    }
  });

  it('illness finds a run-down body more often than a well one', () => {
    const well = illnessChance({ age: 45, health: 85, stress: 10 });
    const rough = illnessChance({ age: 45, health: 25, stress: 10 });
    expect(rough).toBeGreaterThan(well);
  });

  it('stress changes the illness roll and never bills health directly', () => {
    // CORE_RULES 13.8, and 0205's rule that stress costs happiness and school
    // rather than health. Chronic stress belongs in a roll, not in the bar.
    const calm = illnessChance({ age: 45, health: 70, stress: 5 });
    const frayed = illnessChance({ age: 45, health: 70, stress: 85 });
    expect(frayed).toBeGreaterThan(calm);

    const withStress = quiet({ stress: 95 });
    const without = quiet({ stress: 0 });
    expect(withStress.vitality).toBe(without.vitality);
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0417 — a body for its age                                            */
/* -------------------------------------------------------------------------- */

describe('0417 — healing', () => {
  it('heals a share of what is owed, so a big debt comes down faster', () => {
    const small = naturalRecovery(5, TYPICAL_PEAK);
    const large = naturalRecovery(30, TYPICAL_PEAK);
    expect(large).toBeGreaterThan(small);
    expect(large - small).toBeCloseTo(25 * HEAL_SHARE, 6);
    expect(naturalRecovery(0, TYPICAL_PEAK)).toBeCloseTo(RECOVERY_BASE, 6);
  });

  it('settles at a level instead of growing forever under a steady load', () => {
    // A steady 6 points of illness a year, which is what a seventy-five-year-old
    // averages. Flat healing at 3.4 would add 2.6 a year, forever.
    let deficit = 0;
    for (let year = 0; year < 60; year += 1)
      deficit = deficit + 6 - naturalRecovery(deficit + 6, TYPICAL_PEAK);
    expect(deficit).toBeLessThan(15);
    const next = deficit + 6 - naturalRecovery(deficit + 6, TYPICAL_PEAK);
    expect(Math.abs(next - deficit)).toBeLessThan(0.01);
  });

  it('heals a strong body faster than a frail one, within bounds', () => {
    expect(naturalRecovery(10, 100)).toBeGreaterThan(naturalRecovery(10, TYPICAL_PEAK));
    expect(naturalRecovery(10, TYPICAL_PEAK)).toBeGreaterThan(naturalRecovery(10, 55));
    expect(naturalRecovery(10, 1000)).toBe(naturalRecovery(10, TYPICAL_PEAK * 1.4));
    expect(naturalRecovery(10, 1)).toBe(naturalRecovery(10, TYPICAL_PEAK * 0.5));
  });

  it('reads the peak back from where a body is and how old it is', () => {
    let vitality = 90;
    for (let age = PEAK_AGE; age < 85; age += 1) {
      vitality -= ageingLoss(age);
      expect(constitutionOf(vitality, age + 1)).toBeCloseTo(90, 6);
    }
  });
});

describe('0417 — dying, for your age', () => {
  const typicalAt = (age: number) => TYPICAL_PEAK - cumulativeAgeingLoss(age);

  it('does not count age twice: an ordinary body is ordinary at every age', () => {
    // An ordinary eighty-year-old and an ordinary forty-year-old carry the same
    // frailty multiplier, so the ratio of their odds is the Gompertz term's
    // alone. Before 0417 it was that times the frailty an ordinary eighty-year-
    // old's falling health bought them — the same years, charged twice.
    const gompertz = (age: number) => SUDDEN + MORTALITY_AT_60 * 2 ** ((age - 60) / DOUBLES_EVERY);
    const odds = (age: number) => deathChance({ age, health: typicalAt(age), conditions: [] });
    expect(odds(80) / odds(40)).toBeCloseTo(gompertz(80) / gompertz(40), 6);
    expect(deathChance({ age: 80, health: typicalAt(80), conditions: [] })).toBeLessThan(
      deathChance({ age: 80, health: typicalAt(80) - 25, conditions: [] }),
    );
  });

  it('keeps a strong body strong into old age', () => {
    // Twenty points above an ordinary body of the same age is worth the same at
    // eighty as at fifty — the multiplier does not all converge at seventy-five.
    const edge = (age: number) =>
      deathChance({ age, health: typicalAt(age) - 20, conditions: [] }) /
      deathChance({ age, health: Math.min(100, typicalAt(age) + 20), conditions: [] });
    expect(edge(80)).toBeGreaterThan(1.5);
    expect(edge(80)).toBeCloseTo(edge(50), 1);
  });

  it('still makes the old likelier to die than the young, body for body', () => {
    expect(deathChance({ age: 85, health: typicalAt(85), conditions: [] })).toBeGreaterThan(
      deathChance({ age: 65, health: typicalAt(65), conditions: [] }) * 5,
    );
  });
});
