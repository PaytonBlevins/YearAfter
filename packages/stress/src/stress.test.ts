/**
 * Ticket 0205 acceptance tests.
 *
 * The properties that matter here are not "does the arithmetic work" — they are
 * the ones a screenshot would catch too late: is stress reachable, is it
 * escapable, and does an ordinary childhood get taxed by a system nobody can
 * see? Those are the three ways this kind of system fails.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality, createStats } from '@yearafter/character';
import { asNpcId, dollars } from '@yearafter/core';
import type { FamilyMember, Household } from '@yearafter/relationships';
import {
  RELEVANCE_THRESHOLD,
  advanceStress,
  isStressRelevant,
  resilience,
  stressBand,
  stressConsequences,
  stressLine,
  stressSources,
  workloadPressure,
} from './stress';

const member = (
  role: 'mother' | 'father' | 'sibling',
  relationship = 70,
  alive = true,
  diedWhenPlayerWas?: number,
): FamilyMember => ({
  ...(diedWhenPlayerWas !== undefined ? { diedWhenPlayerWas } : {}),
  id: asNpcId(`npc:${role}`),
  role,
  firstName: 'Ana',
  lastName: 'Reyes',
  sex: role === 'father' ? 'male' : 'female',
  birthYear: 1980,
  alive,
  tier: 1,
  personality: createPersonality(),
  relationship,
});

const household = (members: FamilyMember[]): Household => ({
  members,
  finances: { band: 'comfortable', annualIncome: dollars(80_000) },
});

const warmHome = household([member('mother'), member('father'), member('sibling')]);

const inputs = (overrides: Partial<Parameters<typeof stressSources>[0]> = {}) => ({
  // A quiet week: school and nothing else, against an ordinary capacity.
  hours: 3,
  capacity: 20,
  household: warmHome,
  behaviour: 70,
  eventStress: 0,
  age: 14,
  ...overrides,
});

describe('where stress comes from', () => {
  it('finds nothing wrong with an ordinary year', () => {
    expect(stressSources(inputs())).toHaveLength(0);
  });

  it('reads workload as pressure, not as overflow', () => {
    // 0204 only counted hours ABOVE capacity, and that number was zero in every
    // one of 3,400 simulated years — the model had never once engaged.
    expect(workloadPressure(3, 20)).toBe(0);
    expect(workloadPressure(13, 20)).toBe(0);
    expect(workloadPressure(20, 20)).toBeGreaterThan(10);
    expect(workloadPressure(30, 20)).toBeGreaterThan(workloadPressure(20, 20));
    const sources = stressSources(inputs({ hours: 26 }));
    expect(sources.map((source) => source.kind)).toContain('workload');
  });

  it('leaves an ordinary week completely alone', () => {
    // An unremarkable schedule must not be quietly taxed by a system with no UI.
    expect(stressSources(inputs({ hours: 12 }))).toHaveLength(0);
  });

  it('counts a cold household, but not ordinary friction', () => {
    const cool = household([member('mother', 55), member('father', 52)]);
    expect(stressSources(inputs({ household: cool }))).toHaveLength(0);

    const cold = household([member('mother', 20), member('father', 25)]);
    const sources = stressSources(inputs({ household: cold }));
    expect(sources.some((source) => source.kind === 'home')).toBe(true);
  });

  it('treats losing a parent as its own thing, not as accumulated hours', () => {
    const bereaved = household([member('mother'), member('father', 70, false, 13)]);
    const sources = stressSources(inputs({ household: bereaved, age: 14 }));
    const home = sources.filter((source) => source.kind === 'home');
    expect(home.length).toBeGreaterThan(0);
    expect(Math.max(...home.map((source) => source.points))).toBeGreaterThan(15);
  });

  /*
    Ticket 0212. The three properties grief has to have, and the reason it has
    them: until this ticket nobody could die, so a flat permanent penalty was
    indistinguishable from a correct one. The moment NPCs became mortal it made
    every character over forty carry twenty-two points of stress for life about
    something in another decade, and it pulled the player's own p10 age at death
    from 62 to 55. That is the defect these three tests exist to prevent
    returning.
  */
  it('lets grief fade', () => {
    const lost = (yearsAgo: number, age: number) =>
      Math.max(
        0,
        ...stressSources(
          inputs({
            household: household([member('mother'), member('father', 70, false, age - yearsAgo)]),
            age,
          }),
        )
          .filter((source) => source.kind === 'home')
          .map((source) => source.points),
      );
    expect(lost(0, 14)).toBeGreaterThan(lost(3, 14));
    expect(lost(3, 14)).toBeGreaterThan(lost(20, 34));
  });

  it('charges an adult less for it than a child', () => {
    const at = (age: number) =>
      Math.max(
        0,
        ...stressSources(
          inputs({
            household: household([member('mother'), member('father', 70, false, age)]),
            age,
          }),
        )
          .filter((source) => source.kind === 'home')
          .map((source) => source.points),
      );
    expect(at(12)).toBeGreaterThan(at(45));
  });

  it('charges nothing at all for a parent who died decades ago', () => {
    const old = household([member('mother'), member('father', 70, false, 30)]);
    const sources = stressSources(inputs({ household: old, age: 70 }));
    // The sole-parent line may still be there; the BEREAVEMENT one must not.
    const bereavement = sources.filter(
      (source) => source.phrase === 'the house was still short a person',
    );
    expect(bereavement).toHaveLength(0);
  });

  it('lets events push stress in both directions', () => {
    const up = stressSources(inputs({ eventStress: 14 }));
    const down = stressSources(inputs({ eventStress: -9 }));
    expect(up[0]?.points).toBeGreaterThan(0);
    expect(down[0]?.points).toBeLessThan(0);
  });
});

describe('how a character carries it', () => {
  it('costs a tough character less than a fragile one', () => {
    const tough = resilience(createStats({ willpower: 90 }), createPersonality({ temper: 20 }));
    const fragile = resilience(createStats({ willpower: 20 }), createPersonality({ temper: 90 }));
    expect(tough).toBeLessThan(fragile);
  });

  it('lets a good year genuinely undo a bad one', () => {
    // Stress that only accumulates is a second health bar every character loses
    // by eighteen — which is the separate mental-health system spec 1030 forbids.
    let level = 85;
    for (let year = 0; year < 3; year += 1) {
      level = advanceStress(level, [], createStats(), createPersonality());
    }
    expect(isStressRelevant(level)).toBe(false);
  });

  it('does not let one bad year peg a character for life', () => {
    const spike = advanceStress(
      0,
      stressSources(inputs({ hours: 40 })),
      createStats(),
      createPersonality(),
    );
    expect(spike).toBeGreaterThan(RELEVANCE_THRESHOLD);
    const after = advanceStress(spike, [], createStats(), createPersonality());
    expect(after).toBeLessThan(spike);
  });

  it('is reachable at all — a system nobody can trigger is not a system', () => {
    const cold = household([member('mother', 10), member('father', 12), member('sibling', 15)]);
    const level = advanceStress(
      40,
      stressSources({ hours: 30, capacity: 20, household: cold, behaviour: 20, eventStress: 10 }),
      createStats({ willpower: 35 }),
      createPersonality({ temper: 75 }),
    );
    expect(stressBand(level)).toBe('overwhelmed');
  });
});

describe('what the player sees', () => {
  it('stays hidden until it has something to say', () => {
    expect(isStressRelevant(0)).toBe(false);
    expect(isStressRelevant(RELEVANCE_THRESHOLD - 1)).toBe(false);
    expect(isStressRelevant(RELEVANCE_THRESHOLD)).toBe(true);
  });

  it('costs nothing at all while it is hidden', () => {
    // An ordinary childhood must not be quietly taxed by a system with no UI.
    expect(stressConsequences(RELEVANCE_THRESHOLD - 1)).toEqual({
      happiness: 0,
      performance: 0,
    });
  });

  it('costs happiness and school, and never bills health', () => {
    // Spec 1079 names Stress, Happiness and Performance. Health belongs to
    // events and to 0204's physical overload — a screenshot of a busy
    // fourteen-year-old with Health at 29 showed what happens when two systems
    // charge the same account for one schedule.
    const cost = stressConsequences(95);
    expect(Math.abs(cost.happiness)).toBeGreaterThan(Math.abs(cost.performance));
    expect(cost).not.toHaveProperty('health');
  });

  it('says nothing about a year that was fine', () => {
    expect(stressLine(10, 8, [])).toBeUndefined();
  });

  it('names the thing that made the year hard', () => {
    const sources = stressSources(inputs({ hours: 34 }));
    const line = stressLine(75, 20, sources);
    expect(line).toContain('hours');
  });

  it('mentions coming out the other side, but only once it is true', () => {
    expect(stressLine(10, 70, [])).toContain('settled');
    // Caught by reading output: "Things settled down" was being written the year
    // after a divorce, while stress was still at 24. Reassurance the character
    // has not earned reads as the game not paying attention.
    expect(stressLine(24, 70, [])).toBeUndefined();
  });

  it('never shows the player a number', () => {
    for (const level of [0, 35, 65, 95]) {
      const line = stressLine(level, 0, stressSources(inputs({ hours: 30 })));
      if (line) expect(line).not.toMatch(/\d/);
    }
  });
});
